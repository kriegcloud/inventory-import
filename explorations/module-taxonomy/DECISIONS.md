---
type: Decisions
title: Decisions
description: Module taxonomy decisions. The open questions, one decision each, with the option recommended and what it was tried on, and the answered ones with the options he rejected and how to reverse them. Decision 1 was answered twice; the later answer stands.
---

# Decisions

Open questions are listed first. Each is put to Benjamin with its options, the recommended one first; nothing below
is decided until he answers, and no recommendation here is his. Answered decisions move under "Answered" with the
date, the answer and how to reverse it. Where an entry there says the agent placed or decided it, the call is the
agent's, made from his answers beside it, and his to overturn.

## Open

| # | Question | Recommended | Changes | Where it is argued |
| --- | --- | --- | --- | --- |
| 6 | What ending do the two files with none take? (`Adapters.ts` and `Config.ts` in access's host; decision 10a answered `Host.ts` in both hosts) | Asked when its part of the brief opens | | [BRIEF](BRIEF.md), Map |
| 7 | Is each of the three endings used once a kind, or is its file renamed? (`.reference`, `.state`, `.route`) | Asked when its part of the brief opens | Decision 1 as replaced gives a model `.state.ts`; `.state` is asked first | [BRIEF](BRIEF.md), Map |

Decisions 1, 3, 4 and 5 were answered on 2026-11-27 and are under "Answered"; he replaced his answer to 1 the same
day and then answered 2. He raised 8 to 11 (kind folders, the blocks to come, hosts and surfaces, sealed values) and
answered 8a, 8b, 8c, 9a, 9b, 9c, 10a, 10b and 11a; the agent placed 9d and 11b and named the flat modules' unions
(under 8b). Decision 12 records, after the fact, the three calls of his that took the shape past decision 1. 10a
answered 6 for `Host.ts`; the rest of 6, and 7, were not put to him, and neither blocks the brief's first slice.

## Answered

### 2026-11-27: decision 11, sealed values and the Vault

Asked when he said "add Sealed fields and the Vault to the taxonomy too". In the library at `e1c3e6d` a sealed value
is a schema, `Domain.Sealed(S.String)`, used as a field of events and commands; the Vault that opens and shreds it is
`Domain.VaultLive` over a `Domain.KeyStore` and a `Domain.KeyWrap`, provided where the model's Layer is built.

**11a. A sealed value's file.**

- Question: the taxonomy puts a shared value in `<Noun>.schema.ts`. Does a sealed one go there?
- Answer: "Its own ending: .sealed.ts". `Member/Email.sealed.ts`, one sealed value to a file, in the module of the
  subject it is about.
- Rationale: every piece of personal data in a model is found by file name, and the registry can hold rules for the
  kind alone: the file declares one `Domain.Sealed`, and no `.schema.ts` holds one. `block-files` does not read the
  ending yet. Rejected: "A .schema.ts like any value" (found only by searching the code) and "Inside the command that
  sets it" (every other block imports a command to get a value).
- Reverse: rename each to `.schema.ts` and drop the kind from the registry.

**11b. The Vault.** Placed by the agent from decisions 9 and 10; he chose no option.

- Question: does the Vault add a kind, and where is it provided?
- Answer (the agent's): it adds no kind. A query, policy or saga reads it in its own Live (`yield* Domain.Vault`).
  `VaultLive`, its key store and its key wrap are provided in `<Model>.host.ts`, where the model's Layer is built; the
  library's own stores and wraps are used as they are, and one written here is a `.adapter.ts` in the host. A story
  uses the library's test Vault.
- Rationale: 9b (a Live reaches what it needs through what is provided to it) and 10a (`<Model>.host.ts` builds the
  model's Layer). No file declares a Vault, so the registry has nothing to read.
- Reverse: nothing to undo.
- Neither is tried in the experiment: the model has no personal data sealed today, and a sealed field on an event
  changes an aggregate the lock holds.

### 2026-11-27: decision 10, hosts and the surfaces of an Api

Asked when he added Effect Cluster, the CLI and the agent tools and MCP server. None adds a block to a model: in the
library at `e1c3e6d`, `toHttpApi`, `toCli`, `toToolkit` and `toMcp` each take an Api, and
`@alchemy.run/domain/EffectCluster` is a host beside the Cloudflare one. The alchemy-domain brief plans all of them
(its moves 7 and 9).

**10a. A file that runs a model on a platform.**

- Question: what ending does it take, on Durable Objects today and on Effect Cluster later?
- Answer: "One ending: .host.ts". `Catalog.host.ts`, `Usage.host.ts`; the platform is in the file. Cluster's cron and
  singleton are files of their own, `.cron.ts` and `.singleton.ts`. This answers decision 6 for `Host.ts` in both
  hosts; `Adapters.ts` and `Config.ts` stay open.
- Rationale: a model can move between Durable Objects and the Cluster pool (the alchemy-domain decision 27) with no
  rename, and the registry gains one kind. Rejected: "An ending per platform" (`.worker.ts`, `.cluster.ts`) and "A
  folder per platform" (a second folder rule beside decision 8).
- Reverse: rename each to its platform's ending and give the registry one kind per platform.

**10b. A surface derived from an Api.**

- Question: how is the file named and which layer holds it?
- Answer: "An ending per surface, in the host", named for the Api it serves: `Admin.http.ts`, `Admin.cli.ts`,
  `Assistant.toolkit.ts`, `Assistant.mcp.ts`. The model holds only the Api, one `.api.ts` per kind of client.
- Rationale: it is the `.http.ts` kind the hosts have already, and no CLI or AI module reaches a model package.
  Rejected: "One ending: .surface.ts", which renames today's `.http.ts`, and "Beside the Api, in the model".
- Reverse: move each surface beside its Api and open the model layer to those kinds.
- Not tried on Effect Cluster: `@alchemy.run/effect-cluster` is not installed here, so 10a's cluster half is on paper.

### 2026-11-27: decision 9, the blocks the model does not have yet

Asked when he said views, queries, policies, projections, sagas and external systems are coming and the layout
should be settled for them now. None exists in a package today: the model is verified and not hosted. The alchemy-domain
exploration's brief names 26 of them (streams included) and `goals/alchemy-domain-uptake` builds them.

**9a. Where they live.**

- Question: do the read-side and reaction blocks live with the aggregate they read, or elsewhere?
- Answer: "By subject, own modules". A module is a subject and need not hold an aggregate. A view keyed by an
  aggregate sits with it. A projection, its store port and the queries over that store are one module. A policy, a
  saga and an external system sit with the process they drive.
- Rationale: 8a counts per kind, and with everything about the import in `Import/` its root gains a view, two streams,
  five queries, a projection and several policies, none past five, so about twenty files with no folder. By subject,
  `Import/` stays the write side and 8a stands. It is the library's own layout (`Ledger/` beside `Account/`), and the
  package already has `Item/`, `Suggestion/` and `Staging/`. Rejected: "With the aggregate they read", which changes
  8a to count the root, and "Write side and read side split" (`Reading/`, `Reacting/`).
- Reverse: move each block beside the aggregate it reads and reopen 8a.

**9b. Where a block's Live goes.**

- Question: a view, stream, query, projection, policy and saga each have a declaration and a handler Layer. One file
  or two?
- Answer: "Same file as the block". The Live reaches a store only through a `.port.ts`. An external system is the
  exception the library makes: declared in the model, its adapter in the host.
- Rationale: the registry reads one kind per file, and `.handler.ts` retires with the HTTP handlers it holds.
  Rejected: "A sibling .live.ts" (a second file and a new kind per block) and "Keep .handler.ts per module".
- Reverse: split each Live into a sibling file and give the registry the ending.

**9d. Rewrites and compactions.** Added the same day, when he said "add Rewrite and Compaction to the taxonomy too".
Placed by the agent from 9a and 9b; he chose neither option himself.

- Question: where do `Domain.Rewrite` and `Domain.Compaction` live, and where does a compaction's Live go?
- Answer: each is one file, `<Name>.rewrite.ts` or `<Name>.compaction.ts`, in the module of the aggregate it is `of`
  (the endings `block-files` reads already). A rewrite is pure and has no Live. A compaction's Live is in its file and
  writes the replaced events through a `.port.ts`, whose adapter is the host's.
- Rationale: 9b with no exception. The library's example puts a compaction's handler in a sibling `.live.ts` that
  imports an R2 bucket; a model package here imports the library, `effect`, the kernel and its own contract, and
  no driver (`laws boundaries`), so the bucket is behind a port.
  Rejected: the library's `.live.ts`, a second file and a kind for one block.
- The alchemy-domain brief names no rewrite and no compaction. A rewrite is tried in the experiment; a compaction is
  not: its roll-up is an event of its aggregate that `evolve` folds, which changes an aggregate the lock holds.
- Reverse: split a compaction's Live into `<Name>.live.ts` and give the registry the ending.

**9c. How far this exploration goes.**

- Question: the real blocks are the uptake goal's. What does this packet do to prove the layout?
- Answer: "One trial block per kind". All 26 are placed in the brief, and the catalog-model experiment gets one small
  block of each of the seven read and reaction kinds in its decided home, and a rewrite (9d), with what Verify, the
  lock and the type check do with them recorded in its `NOTE.md`. A trial block is never copied into a package.
- Rationale: rejected "Paper only" (the uptake goal would find any surprise) and "Build the import's real ones"
  (overlaps the uptake goal's move 3 and the session on it).
- Reverse: drop the trial blocks from the experiment.

### 2026-11-27: decision 8, kind folders

Asked after he proposed `commands/` and `events/` folders for `Import/`, which holds 7 commands and 9 events among 21
files in one flat listing.

**8a. When a kind gets a folder.**

- Question: when does a module's files of one kind move into a folder named for the kind?
- Answer: "Per kind, over 5 files". The folder takes the kind's plural (`commands/`, `events/`); the file keeps its
  singular ending (`.command.ts`, `.event.ts`, and `.transition.ts`, `.rejection.ts` at the module's root).
- Rationale: a flat listing sorts by noun, so `Import.aggregate.ts` falls between `GroupCounted.event.ts` and
  `ImportConfirmed.event.ts`; with the folders the module's own four files are what the folder shows. A number lets
  `block-files` refuse both a folder of five or fewer and a flat kind of six or more. The union file is not counted.
  Today `Import/` folds both kinds; `Row/`, `Group/` and `Review/` stay flat. Rejected: "Per module, all or nothing",
  "Always folders" (a `Row/events/` of two files) and "Author's judgment" (no check).
- Reverse: move the files back beside the aggregate and rewrite the imports; no export or rule changes.

**8b. Where a union lives.**

- Question: `Import.union.ts` holds `ImportCommand` and `ImportEvent`. Where do they live beside the folders?
- Answer: "A .union.ts in each folder": `commands/ImportCommand.union.ts` and `events/ImportEvent.union.ts`.
- Rationale: an import here names its file, so `index.ts` shortens no path, and it has no ending for the registry of
  decision 3 to read. One ending serves folded and flat modules. Rejected: "index.ts holding only the union",
  "index.ts as union plus barrel" (the repository's import standard refuses barrels, and whether Verify follows a
  schema through a re-export was not tried) and "Keep Import.union.ts at the root".
- Decided by the agent from this answer, for one rule everywhere: a union file is named for the union it exports, so
  the flat modules' `Row.union.ts` and `Group.union.ts` become `RowEvent.union.ts` and `GroupEvent.union.ts`.
- Reverse: put both unions back in `Import/Import.union.ts`; rename the two flat files back.

**8c. `Review/`.**

- Question: `Review/` has 4 commands, 4 decisions and 4 transition files among 14. Folders by kind, by act, or none?
- Answer: "Stay flat".
- Rationale: no kind passes five, so 8a decides it with no exception, and `Deciding.decision.ts` sorts beside the
  `Deciding.transition.ts` it lists. Rejected: "A folder per act" (a second folder rule) and "Kind folders here too".
- Reverse: nothing to undo.

### 2026-11-27: decision 12, the shape past decision 1

Recorded on review, after the fact. Each call below was his, made in conversation the same day as the experiments
ran (the README's Trail has each); none had an entry here, and decision 1 as replaced still said the transitions and
the unions stay in the aggregate's file.

- Question: do the transitions, the unions and the state's cases stay as decision 1 left them?
- Answer: no, three calls of his. The transitions are listed by name from `<Noun>.transition.ts` ("the transitions by
  name"). Both patches to the library go into `packages/patches` ("Yes, both patches": `04-a-rule-by-its-name` and
  `05-a-structs-defaults`). A state's cases are exported under their own names as branded classes, with starting
  values on their fields and the union under the name `State`. The unions' own files are decision 8b.
- Rationale: an aggregate's file becomes a listing, as an Api's and a model's are, and a starting value is said once,
  on the schema. Tried on the whole model in `scratchpad/experiments/catalog-model`: verified against the package's
  lock, the lock unchanged, and a weakened moved rule refused by name.
- Costs he took: two patches to carry until the library does the same; a rule's type is written on its name and
  never on its parameters, or its text is not the locked text; a default only on the case a value starts in.
- Reverse: write each rule back inline in its aggregate's or decision's file and each starting value back in its
  `make`; patches `04` and `05` can then go. The lock holds in both directions, since no rule's text changes.

### 2026-11-27: decision 2

Asked by dialog after decision 1 was replaced. He picked the recommended option.

**2. Who holds the stem, the exports and the namespace import.**

- Question: is "an event's or a command's file has its tag for a stem, exports its kind's names and is imported as a
  namespace" a law or a convention?
- Answer: "A law". `laws block-files` compares each block's tag with its file's stem, holds a `.event.ts` to `Event`
  and `evolve` and a `.command.ts` to `Command`, `decide` and its own rejections, and refuses a named import of
  `Event` or `Command`.
- Rationale: nine classes of `Import` are named `Event`, and an editor offers `import { Event }` for each. Rejected:
  "A law, without the import rule"; "A convention", held by review. Nothing of the law is written or tried.
- Not decided by it: what a decision's, an aggregate's or a rejection's file exports. They keep their own names.
- Added by the agent on review, his to overturn: a command's file may also export a helper its decision's rules call
  by name. The verified model has one, `changesNothing` in `DecideRow.command.ts`, which fourteen locked rules call.
- Reverse: take the three checks out of `block-files`; no file changes.

### 2026-11-27: decision 1, replaced

Asked by dialog twice after the first answer below: whether the namespace shape replaces it ("Yes, adopt it"), then
which names the files export ("Role names, event per file"). Both were the recommended option.

**1. Where an event, a command and their logic live.**

- Question: does an event's `evolve` sit beside the event and a command's `decide` beside the command, and what does
  each file export?
- Answer: "Role names, event per file". One event to `<Tag>.event.ts`, exporting `Event` and `evolve`. One command to
  `<Tag>.command.ts`, exporting `Command`, `decide` and the rejections only it returns. Each is imported as a
  namespace named for its stem: `ImportStaged.Event`, `ImportStaged.evolve`, `StageImport.Command`,
  `StageImport.decide`. The state and the invariants are in `<Aggregate>.state.ts`; the aggregate's file keeps the two
  unions, the transitions and the listing (superseded for the unions by decision 8b and for the transitions by
  decision 12).
- Rationale: his, that Effect's and the library's own modules are read this way (`Option.map`) and that a file read
  as a namespace gives every block of a kind the same names. An event has its own file because four of the model's
  eleven commands record an event another file declares, and `UndoGroup` records two. Tried on `Import` as sixteen
  files (`scratchpad/experiments/import-module`): it proves what the package's one file proves, a broken moved
  `decide` and a broken moved `evolve` are each caught, and the whole model verifies against the package's lock, the
  lock unchanged (`scratchpad/experiments/command-file`, `model-role`). Both experiments were dropped the same day
  and are in history at `ba3ac17f`; `catalog-model` carries their findings.
- Rejected: "Role names, events stay with commands" (`StageImport.Event`), which loses the event's word and has no
  place for a second event; "Named exports, as built" (`StageImport.ImportStaged`, `ActCounted.ActCounted`), also
  verified; `evolve` and `decide` as statics of the class, which the prover reads only with about forty lines added
  to it (`prover-static-member.patch`); and the first answer below.
- Costs he took: the 60 mutants that name `Import.aggregate.ts` each change a line of a `decide` and are written
  again; `.state.ts` and `.event.ts` become kinds; every event's class is named `Event` where a hover or a stack
  trace shows a class's name; the transitions do not move, because the lock keeps each rule's text (until decision
  12's patch).
- Reverse: move each `evolve` and `decide` back into the aggregate's or the decision's file and each event back
  beside the command that records it, and rename the classes to their tags. No rule and no tag changes either way,
  so the lock holds in both directions.

### 2026-11-27: decisions 1, 3, 4 and 5

Asked by dialog, each with its options, the recommended one first. He picked the recommended option of each.

**1. Where a command of the model lives.** Replaced the same day; see above.

- Question: does a command stay in the file of the aggregate or decision that decides it, or take a file of its own,
  and does its `decide` go with it?
- Answer: "Own file, decide stays". One command to a `.command.ts`, with its events and the rejections only it
  returns; its `decide` stays in the aggregate or the decision.
- Rationale: the library's own layout, and verified on a copy of the whole model against the package's lock
  (`scratchpad/experiments/command-file`, `model-split-command`, run after his answer; in history at `ba3ac17f`).
  Rejected: "Own file with its decide", also verified, which needs the state in a file of its own (an ending
  `block-files` does not have) and 60 of the model's 192 mutants written again; and
  "As today". It replaces "Hold all kinds" (2026-11-26) for commands. A rejection several commands return moves to a
  `.rejection.ts` with the first of them that moves.
- Reverse: move each command, its events and its rejections back into its decider's file; `block-files` allows both
  places today.

**3. A registry of kinds.**

- Question: is there one registry of kinds (the ending, what the file declares, which layer holds it, who may import
  it) that the laws read, and how far does it reach?
- Answer: "Every context layer". `contract`, `model`, `host` and `web`.
- Rationale: sixteen of the 173 files of the catalog and access contexts are refused by a first cut of it
  (`scratchpad/experiments/kind-registry`), and no import crosses a door it closes. Rejected: "Every package" (not
  counted yet), "Model and contract only" (the reach of `block-files` today) and "No registry".
- Reverse: `block-files` and `boundaries` go back to their own tables; no file is renamed back by that alone.

**4. A port's ending.**

- Question: eight `.store.ts` files and one `.gateway.ts` declare a `Context.Service` port, as the two `.port.ts`
  files do. Do the three endings become one?
- Answer: "One ending, .port.ts".
- Rationale: `block-files` reads the three as one kind already. Rejected: "Keep three kinds", each with what it must
  declare.
- Reverse: rename the nine files back and give the registry the two endings as kinds.

**5. Export keys.**

- Question: do a package's export keys take the file's path and kind?
- Answer: "Leave them".
- Rationale: the doors are checked by resolving an import through the package's `exports`, as the kind-registry
  experiment does. Rejected: "Path and kind in the key", which rewrites 150 keys and the 312 imports of them in the
  two contexts.
- Reverse: nothing to undo.
