---
type: Brief
title: "Brief: module-kinds"
description: The goal module-kinds. One registry of file kinds that the repository's laws read, for the four layers of a context; a port under one ending; and each event and each command of the catalog's model in a file of its own, read as a namespace.
---

# Brief: `module-kinds`

Benjamin's words, 2026-11-27: "following the principles of what we've just done with Rpcs could achieve an extremely
consistent module structure & taxonomy throughout a repo." The reading is [the README](README.md); his answers are in
[DECISIONS.md](DECISIONS.md), and this brief is built on decisions 1 to 5 as he answered them: 1 as he
replaced it the same day, which rewrote every part here about commands.

Nothing here is built. No file in `packages/` or `apps/` has changed and no goal is open. Every number was measured on
this repository at `a184783d` by the experiments under `scratchpad/experiments/`.

## Problem

A file's ending says what kind of thing it holds, and one law checks that for the library's blocks
(`laws block-files`, seventeen endings, in `model` and `contract` packages). Outside that:

- **Nothing lists the kinds.** The four layers of the catalog and access contexts use thirty endings; the law knows
  the library's. What a `.read.ts`, an `.adapter.ts` or a `.atoms.ts` must hold, and which layer may hold it, is in
  nobody's table.
- **One kind has three endings.** Eight `.store.ts` files and one `.gateway.ts` declare a `Context.Service` port, as
  the two `.port.ts` files do.
- **Four files have no ending** (`Host.ts` in both hosts, `Adapters.ts` and `Config.ts` in access's), and three
  endings are used once (`.reference`, `.state`, `.route`).
- **Which layer may load which kind is held by layer only.** `laws boundaries` says `web` may import `model`. That a
  screen never loads a port, a handler or an in-memory twin is true today (0 of 269 imports) and held by nothing.
- **A command is found by reading its decider.** `Import.aggregate.ts` is 725 lines: seven commands, nine events and
  thirteen rejections above the aggregate, then every `decide` and `evolve` inside it. What one event does to an
  import is 500 lines from the event.
- **No two blocks of a kind export the same names.** An event's class, its `evolve` and a command's `decide` are
  found by reading, not by knowing the kind.

## Appetite

Scope, not time. In:

- The registry as a schema and a table in `packages/tooling/tool/cli`, and `laws block-files` and `laws boundaries`
  reading it for `contract`, `model`, `host` and `web`.
- The nine port files renamed to `.port.ts`, with their export entries and imports.
- Each event of the catalog's model moved to `<Tag>.event.ts`, exporting `Event` and `evolve`; each command to
  `<Tag>.command.ts`, exporting `Command`, `decide` and the rejections only it returns; each shared rejection to a
  `.rejection.ts`; an aggregate's state and invariants to `<Aggregate>.state.ts`. Every such file is imported as a
  namespace named for its stem.
- `.event.ts` and `.state.ts` as kinds of the registry, and the model's mutants that name a moved line written
  again (60 name `Import.aggregate.ts`).
- An ending for each of the four files that have none and a kind or a rename for each of the three one-off endings,
  once he has answered what they are (decisions 6 and 7).

Out:

- Any change to what the code does, to a rule of the model, or to a sentence a person reads.
- Export keys (decision 5: "Leave them").
- The packages outside a context: the kernel, the drivers, the client, the review package, infra, the CLI, the app.
- Splitting the 23 `.rules.ts` files of the two models by what each is.
- Moving a transition, or the two unions it reads, out of an aggregate's file: the lock keeps each rule's text.
- `evolve` or `decide` as a static of a class, and any change to the prover.
- Role names for a decision, an aggregate or a rejection. They keep their own names.

## Sketch

**The registry.** One record by ending. Each kind says what the file declares, which layers may hold it and which
layers may import it from another package; an ending may be named as another kind's until its files are renamed.
`scratchpad/experiments/kind-registry/Kinds.registry.ts` is a first cut with 28 kinds; its `classify` and `doorOpen`
are the two questions the laws ask.

**The laws.** `block-files` keeps its own reading of what a file declares, from the syntax tree, and takes the list
of endings and layers from the registry instead of its six tables. `boundaries` resolves each import of a context's
package through that package's `exports` to a file, and asks the registry whether the importer's layer may load that
kind. The experiment's test does both readings over the real tree in under a second.

**The blocks of a model.** `scratchpad/experiments/catalog-model/model` is the shape, on the whole catalog model:
52 files where twelve were.

| File | Exports | Read as |
| --- | --- | --- |
| `<Tag>.event.ts` | `Event`, `evolve` | `ImportStaged.Event`, `ImportStaged.evolve` |
| `<Tag>.command.ts` | `Command`, `decide`, the rejections only it returns | `StageImport.Command`, `DecideRow.decide` |
| `<Noun>.rejection.ts` | each rejection several commands return, by its own name | named imports |
| `<Noun>.state.ts` | each case by its name (a branded `S.Opaque` class), `State`, `guards`, `cases`, `isAnyOf`, each invariant, and what is worked out of a state | `ImportState.State`, `ImportState.Open`, `ImportState.guards.Open` |
| `<Noun>.transition.ts` | each rule of a step, by its own name | named imports, listed by name |
| `<Union>.union.ts` | one tagged union, the file named for it (decision 8b) | `ImportEvent.guards.ActCounted` |
| `<Noun>.aggregate.ts`, `<Noun>.decision.ts` | the class: a listing and nothing else | as today |

A listing has every key equal to its namespace: `evolve: { ImportStaged: ImportStaged.evolve }`,
`decide: { StageImport: StageImport.decide }`, `commands: [StageImport.Command]`; a decision's is
`decide: DecideRow.decide`, its command's file holding the `decide` typed by `Domain.Decision.Read`. A command's
file imports the event's to record it (`ImportStaged.Event.make(...)`). A starting value is on the state's schema:
`ImportState.Open.make({ organizationId, rows, columns })` is a staged import, and no `make` writes a `status`. No
tag changes, so `guards`, `catchTag`, an Api's command list and the lock read as before. The whole model verified
against the package's lock, the lock unchanged, with the two patches below installed.

**Folders (decision 8).** A kind with more than five files in its module moves into a folder named for the kind's
plural, with its union beside the files it joins: `Import/commands/` (seven commands and `ImportCommand.union.ts`)
and `Import/events/` (nine events and `ImportEvent.union.ts`). `Row/`, `Group/` and `Review/` stay flat. No file is
named `index.ts`.

**The blocks to come (decision 9).** A module is a subject and need not hold an aggregate. Each block is one file
holding its declaration and its Live, which reaches a store through a `.port.ts`; an external system's adapter is the
host's. The 24 blocks the alchemy-domain brief names, placed by that rule. A module marked "to name" is one that
brief does not say enough to place; the uptake goal names it when it builds the block.

| Model | Module | Blocks |
| --- | --- | --- |
| Catalog | `Import/` | `ImportStatus.view.ts`, beside the aggregate it is keyed by |
| Catalog | `Draft/` | `DraftRows.projection.ts`, `DraftStore.port.ts`, `ImportActs.stream.ts` (the projection appends to it), `ImportReview.query.ts`, `MySteps.query.ts`, `ImportResultCounts.query.ts` |
| Catalog | `Item/` | the `Item` aggregate, `ItemRows.projection.ts`, `ItemsPage.query.ts`, `ItemFacets.query.ts`, `CreateItems.saga.ts` |
| Catalog | `Suggestion/` | `SuggestOnAsk.policy.ts`, `SuggestionPass.saga.ts`, `Suggester.external.ts` |
| Catalog | `Staging/` | `UploadDeadline.policy.ts` |
| Catalog | to name (the lists) | `OpenImports.query.ts`, `PastImports.query.ts`, `ImportHistory.stream.ts`, and the projection that writes them |
| Catalog | to name (telling people) | `MailOnConfirm.policy.ts`, `Mailer.external.ts`, `TellTheChannel.policy.ts`, `TeamChannel.external.ts` |
| Catalog | to name | `Decider.external.ts`, `CatalogueHistory.external.ts` |
| Usage | `Allowance/` | `AllowanceToday.view.ts`, beside its aggregate |
| Access | `Member/` | `MemberRows.projection.ts`, `EndReadsOnRemoval.policy.ts` |

A rewrite and a compaction (decision 9d) are each one file beside the aggregate they are `of`: `<Name>.rewrite.ts`,
which is pure and has no Live, and `<Name>.compaction.ts`, whose Live writes the replaced events through a
`.port.ts`. The alchemy-domain brief names none of either yet.

A sealed value (decision 11) is `<Noun>.sealed.ts`, one `Domain.Sealed` to a file in the module of its subject, so a
model's personal data is found by file name. The Vault adds no kind: a Live reads it, and `<Model>.host.ts` provides
`VaultLive` with its key store and key wrap.

**Hosts and surfaces (decision 10).** Neither adds a block to a model. A file that runs a model on a platform is
`<Model>.host.ts` whatever the platform (`Catalog.host.ts` on Durable Objects, `Usage.host.ts` on Effect Cluster,
with `<Name>.cron.ts` and `<Name>.singleton.ts` beside it). A surface derived from an Api is a host file named for
that Api and ending in the surface: `Admin.http.ts`, `Admin.cli.ts`, `Assistant.toolkit.ts`, `Assistant.mcp.ts`. The
model holds one `.api.ts` per kind of client.

One block of each of the seven kinds is tried in the catalog-model experiment in its home here (decision 9c).

## Rabbit holes

- **The uptake goal moves the same files.** `goals/alchemy-domain-uptake` rewrites handlers, stores and adapters into
  blocks of the library: a `.store.ts` renamed here may be a projection's port or gone there. The port renames go
  first or wait for the move that touches each file; they never run beside it.
- **`block-files` allows a command in its decider's file, and has no `.event.ts` or `.state.ts`.** The two kinds
  are added before the first file moves. Once the commands and events have moved, the allowance is taken out, or the
  two places drift apart again. The law was not run on the experiment's files.
- **`.state.ts` is taken once already.** `ItemEditor.state.ts` in `catalog/web` is one of decision 7's three one-off
  endings. A model's `.state.ts` is another thing under the same ending: decision 7 is answered for `.state` before
  the kind is written, or the registry holds one ending with two meanings.
- **A named import of `Event` or `Command`.** Nine classes of `Import` are named `Event`. The editor will offer
  `import { Event }`. Decision 2 makes refusing it a law; that check lands before the first event moves.
- **Inside its file `Event` hides the DOM's.** No file of the model uses that one; a diagnostic that minds was not
  met by `scratch:check`.
- **A class's own name.** Where the library or a tool prints a class's name and not its tag, every event reads
  `Event`. Not looked for: read the library's use of a class's `name` before the first move.
- **The transitions move only with the repository's patch to the lock.** The library's lock keeps the text written at
  the rule's place in the aggregate, so a rule listed by name was refused. `packages/patches`,
  `alchemy-domain/04-a-rule-by-its-name`, makes it keep the text the name is declared as; with it all 124 rules of
  the model are in `.transition.ts` files and verify against the unchanged lock. A rule's declaration carries its
  type on its name, never on its parameters, or its text is not the locked text. `invariants` and `transitions` are
  still objects written in the aggregate's file: imported whole, the prover finds none. The patch goes when the
  library does this itself.
- **A listed invariant and the lock.** The same patch closes it: an invariant listed by name is kept as its body,
  and a weaker one in `<Noun>.state.ts` is refused by name (the patch's own test).
- **Defaults on the state need the second patch.** The library's prover reads a `make` as the object written.
  `alchemy-domain/05-a-structs-defaults` reads a constructor default that is a number, a text, a truth or `null`,
  and says "not supported" of any other (a list, an `Option`, a struct, one worked out when asked for). A default
  goes only on the case a value starts in: on a case whose fields are carried from the state before, it would turn
  a forgotten field into a silent zero.
- **A branded field loses its brand under `S.annotateKey`.** A field whose schema is an `S.Opaque` class is left
  bare, and the class's description stands for it.
- **`laws model-inputs`.** Every file a model, an aggregate or a decision imports must be an input of the package's
  `verify`, `prove` and mutant tasks. Each new `.command.ts` and `.rejection.ts` is one.
- **The mutants.** Each names a file, an anchor and a line's exact text with its indentation. All 60 that name
  `Import.aggregate.ts` change a line of a `decide`; both the file and the indentation change. They are written
  again in the change that moves the `decide`, and `mutants:sample` is run on it. The other 132 were not all read.
- **Export entries.** Exports are exact, one entry a file. A command or an event another package imports today
  through `./ImportAggregate` needs an entry of its own and a namespace import there. Eight files import one of the
  import's events or commands by name today: four of the model's source, three of its tests and one test of
  `catalog/web`. The experiment rewrote the four.
- **`.rules.ts`.** The registry holds it as one kind. Asking what each of the 23 is belongs to another goal.
- **The table of who holds what was written from today's tree.** It refuses no file for its layer by construction.
  Before it is a law, each row is read against what the layer is for, not against what is there.

## No-gos

- No folder for one block and no `index.ts` anywhere: a folder is for a kind with more than five files in its module
  (decision 8), and a union has its own `.union.ts`. No role names beyond the four decision 1 gives (`Event`, `evolve`,
  `Command`, `decide`).
- No event or command moved before `block-files` holds decision 2's three checks.
- No rule of the model changes, and the lock is not updated: a run that needs `UPDATE_VERIFY_LOCK=1` is a failed move.
- No rename in a file another open goal is moving, in the same change.
- No registry row for a package outside a context until that package has been counted.

## Map

| Part | Goal | Built on |
| --- | --- | --- |
| The registry as a schema and a table | `module-kinds`, first slice | NET-NEW in `packages/tooling/tool/cli/src/commands/Laws/`; the cut in `scratchpad/experiments/kind-registry/Kinds.registry.ts` |
| `block-files` reading the registry | `module-kinds`, first slice | `packages/tooling/tool/cli/src/commands/Laws/BlockFiles.rules.ts` (its `placed`, `reserved`, `declarers`, `holds`, `besideItsOwn`, `homes`) and `test/BlockFiles.test.ts` |
| Nine ports under `.port.ts` | `module-kinds`, first slice | the eight `.store.ts` files of `packages/catalog/model` and `packages/access/model`, and `packages/access/contract/src/Allowance/ModelAllowance.gateway.ts` |
| `boundaries` asking the registry about each import's kind | `module-kinds`, later, when the first slice is merged | `packages/tooling/tool/cli/src/commands/Laws/Boundaries.rules.ts`; the reading in `scratchpad/experiments/kind-registry/KindRegistry.test.ts` |
| `.event.ts` and `.state.ts` as kinds, and the law of decision 2: stem is tag, a kind's export names, no named import of `Event` or `Command` | `module-kinds`, later, before the first event moves | `Kinds.registry.ts`, `BlockFiles.rules.ts` |
| Every block of the catalog model in a file of its kind, read as a namespace | `module-kinds`, later, when no move of `alchemy-domain-uptake` is open on `packages/catalog/model` | `packages/catalog/model/src/Import/Import.aggregate.ts`; `scratchpad/experiments/import-module`; the 60 mutants |
| The same for `Row` and `Group`, and what a decision's file becomes | `module-kinds`, later, after `Import`; the decision's shape is not designed | `Row.aggregate.ts`, `Group.aggregate.ts`, the four `Review/*.decision.ts` |
| The four files with no ending and the three one-off endings | `module-kinds`, later, when decisions 6 and 7 are answered | `packages/*/host/src/Host.ts`, `packages/access/host/src/Adapters.ts` and `Config.ts`; `ItemsOfRow.reference.ts`, `ItemEditor.state.ts`, `SignIn.route.ts` |
| The registry for packages outside a context | not this goal | NET-NEW; needs the census first |

The first slice is the registry, `block-files` reading it, and the nine renames: it changes no code a proof reads,
and `bun run check` holds it.
