---
type: Exploration
title: Module taxonomy
description: Whether the per-unit module shape tried on RPCs in beep-effect (one unit, role-named files, a contract door and a handler door) gives @alchemy.run/domain blocks, and the rest of this repository, one consistent structure. A reading from source and two experiments run: a command in its own file proves as before, and a registry of kinds refuses sixteen of the two contexts' 173 files.
status: active
stage: shape
next: he says whether the import-module shape (each command's file read as a namespace) replaces decision 1; the brief matches as written (2026-11-27); decisions 2, 6 and 7 are open
goals: []
---

# Module taxonomy

Benjamin, 2026-11-27: "abstractions like Domain.Model, Domain.Command, Domain.Aggregate, Domain.Event, Domain.Api
etc following the principles of what we've just done with Rpcs could achieve an extremely consistent module structure
& taxonomy throughout a repo. Could you explore this and tell me what you think & how it might look?"

What "what we've just done with Rpcs" means, from beep-effect's `scratchpad/int/rpcs`:

```
rpcs/Posts/Posts.contract.ts    exports Payload, Success, Failure, Contract
rpcs/Posts/Posts.handler.ts     exports Handler, checked with `satisfies Rpc.ToHandlerFn<typeof Contract>`
rpcs/Posts/index.ts             the contract only
rpcs/index.ts                   export * as Posts ...      the contract door
rpcs/handlers.ts                export { Handler as Posts } the handler door
protocol.ts                     RpcGroup.make(Posts.Contract, ...)   lists, nothing else
protocol.handler.ts             ReaderRpcs.toLayer({ Posts: Handlers.Posts, ... })
```

Everything below was read from this repository at `abc487d6` and the installed library at `e1c3e6d`
(`node_modules/@alchemy.run/domain/src`). Two things were run: experiments 1 and 3, under "What I would try first". The rest
is from reading, and each claim about the prover that only a run would settle is marked.

## What I think

Yes to the goal. No to copying the shape. Three of the five things the RPC structure does carry over; two do not,
and forcing them would make the model harder to read.

| The RPC structure does this | For domain blocks |
| --- | --- |
| The file's ending names its kind | Already here, and already a law (`laws block-files`). The gap is the kinds the law does not know. |
| Assembly files only list | Carries over. `Catalog.model.ts` is 212 lines, of which about 90 are helper functions for invariants. |
| A client cannot reach handler code | Carries over, and gets stronger: the doors become a table of kind by layer, held by `laws boundaries`. |
| Uniform export names (`Contract`, `Handler`, `Payload`) read through a namespace | Does not carry over. See below. |
| A folder per unit with a barrel | Does not carry over. See below. |

### The class is already the namespace

`Posts.Contract` needed a folder and a barrel because an RPC is a bundle of loose values with no name of its own. A
block of the library is a class, and the class already carries its roles as statics: `Import.ref(id)`,
`Import.predict(...)`, `DecideGroup.tag`, `SomePolicy.toLayer(...)`, `X.definition`, `X.annotations`. The mapping is
direct:

| RPC | Domain |
| --- | --- |
| `Contract` | the declaration: `class X extends Domain.<Kind>(...)` |
| `Payload` / `Success` / `Failure` | a command's `input` / `reply` / `rejects`; a query's `input` / `success` / `rejects` |
| `Handler` | what is handed to `X.toLayer(...)`; for a command, its `decide` |
| `satisfies Rpc.ToHandlerFn<typeof Contract>` | `toLayer`'s own parameter type; `Policy.Handler<Policy.TriggerOf<typeof X>>` if the function is written apart (`src/Policy.ts:52`, `:82`) |
| `RpcGroup.make(...)` | `Domain.Model(...)`, and `Domain.Api(...)` for what one kind of client sees |
| `Group.toLayer({...})` | `Layer.mergeAll(...Live)` in `Catalog.handlers.ts` |

So a folder named `DecideGroup/` with an `index.ts` would build a namespace that exists already.

### Uniform names would cost the model its words

In the RPC files `Failure` wraps `MapFailure`: the real name survives underneath. In a model the block is the word.
Three things in the library key on it:

- `evolve: { GroupDecided: ... }`, `Effect.catchTag("NotOpen", ...)`, `ImportEvent.guards.GroupCounted` and an Api's
  `commands: ["DecideGroup"]` all name a block by its tag.
- An event is not owned by one command. `GroupCounted` is recorded by `DecideGroup` and folded by `Import`; `NotOpen`
  is declared in `Import.aggregate.ts` and returned by all four decisions as well. An RPC has exactly one payload, one success and one failure; a command
  has any number of events and rejections, shared with others. There is no slot to name.
- A hover over a decide would read `Effect<Event[], Rejection | Rejection | Rejection>`.

The rule that gives the consistency he is after is the opposite one: **a block's exported name is its tag, and its
file's stem is that name.** The repository nearly holds it today. It is not a law.

### What is missing is not a shape, it is a list

`laws block-files` knows seventeen endings, all for the library's blocks. Counted in `src` folders outside `foundation` and `ui`,
the repository uses at least 49 file endings. What that shows:

- `.rules.ts` is 72 files. An ending that fits everything classifies nothing.
- A hand-written `Context.Service` port has three endings (`.port.ts`, `.store.ts`, `.gateway.ts`: 11 files) and the
  law treats them as one.
- `.command.ts` is 14 files and none is a `Domain.Command`: all are CLI commands in `packages/tooling`. The catalog's
  commands sit in `.aggregate.ts` and `.decision.ts` files, which the law allows. So the same ending means two things,
  told apart only by the package's layer.
- Eighteen endings are used once. `.hook.ts` and `.hooks.ts` both exist.
- "Model" means three things: the package layer (`packages/catalog/model`), `Domain.Model` (`Catalog.model.ts`), and
  a data model in the everyday sense. His list starts with `Domain.Model`; in this library that is the assembly of a
  whole bounded context, the counterpart of `RpcGroup.make`, and not an entity's schema. An entity's schema here is
  `.schema.ts`, `.id.ts` or an aggregate's `state`.

## How it might look

### One registry of kinds, as data

A kind is five facts. Written once as a schema in `packages/tooling`, read by the laws and by a generator:

| Fact | Example: `policy` | Example: `adapter` |
| --- | --- | --- |
| ending | `.policy.ts` | `.adapter.ts` |
| what the file must declare | one `Domain.Policy` | one `Layer` for a port |
| layers that may hold it | `model` | `host` |
| layers that may import it | `model`, `host`, tests | `host`, the app's server |
| where its implementation goes | same file (`XLive`), or `host` if it needs a driver | it is one |

`block-files` becomes the first reader of that table, widened from "the library's blocks in `model` and `contract`"
to "every file in every layer has an ending the registry knows, and holds what the ending says". `boundaries` becomes
the second reader. `bun run beep new <kind> <Name>` writes a file from the kind's template, the way `scratch new`
does.

A first cut of the registry, from the endings in use. The left column is the library's; the right is this
repository's own.

| Role | The library's kinds | House kinds |
| --- | --- | --- |
| Words | `.command.ts` (with its events and rejections), `.rejection.ts` (shared), `.id.ts` | `.schema.ts`, `.read.ts` and `.payload.ts` (wire shapes, `contract` only) |
| Deciders | `.aggregate.ts`, `.decision.ts` | `.rules.ts`, once it means one thing |
| Reads | `.view.ts`, `.query.ts`, `.stream.ts`, `.projection.ts` | |
| Reactions | `.policy.ts`, `.saga.ts` | |
| Edges | `.external.ts`, `.middleware.ts`, `.context.ts` | `.port.ts` (one ending for `Context.Service`), `.adapter.ts`, `.memory.ts` |
| Assembly | `.model.ts`, `.api.ts` | `.handlers.ts`, `.http.ts`, `.stack.ts` |
| Screens | | `.screen.tsx`, `.atoms.ts`, `.controller.ts`, `.machine.ts` |

### The doors are kinds

beep-effect needed two barrels because a barrel is the only place a folder can say "this half is for clients". Here
the layers already say it (`web -> model -> contract`, `host -> model -> contract`), and the ending says the rest.
For it to be checkable at the import site, the import path has to show the ending. Today it does not:

```jsonc
// packages/catalog/model/package.json, today: the key drops the folder and the kind
"./DecidingGroup": "./src/Review/DecidingGroup.decision.ts"

// proposed: the key is the path under src. Still exact, one entry a file, no wildcard; written by config-sync.
"./Review/DecideGroup.decision": "./src/Review/DecideGroup.decision.ts"
```

Then `@inventory/catalog-model/Review/DecideGroup.decision` tells a reader, and `laws boundaries`, what is being
imported, and "a screen imports no `.adapter`, `.memory` or `.handlers`" is one row of the registry instead of a
second barrel in every folder. The prover's resolver matches exact export keys first
(`Prove/internal/Resolve.ts:75`), so a key with a dot in it should resolve; that is from reading, not from a run.

### A folder is a subdomain, a stem is a unit

No folder per block and no `index.ts` inside a package: the library's layout says the same ("Don't add barrel
files"). Files that belong to one unit share a stem and sort together. The catalog's review, as it would read:

```
packages/catalog/model/src/
  Catalog.model.ts              aggregates, decisions, relations, invariants: a list
  Catalog.invariants.rules.ts   the helper functions the invariants call (about 90 lines of the model file today)
  Catalog.api.ts
  Catalog.handlers.ts           Layer.mergeAll of every Live: the one handler door
  Actor/
    Actor.context.ts
    Session.middleware.ts
  Import/
    Import.aggregate.ts         id, state, evolve, invariants, transitions; lists its commands
    StageImport.command.ts      the command, the events it records, the rejections only it returns
    MatchColumn.command.ts
    ConfirmImport.command.ts
    NotOpen.rejection.ts        returned by several commands
  Group/
    Group.aggregate.ts
  Review/
    DecideGroup.command.ts      DecideGroup, StepTaken
    DecideGroup.decision.ts     DecidingGroup: reads Import and Group
    UndoGroup.command.ts
    UndoGroup.decision.ts
    Change.schema.ts
```

Two changes from today, both small in idea and large in lines moved:

1. **One command to a `.command.ts`**, which is the library's own layout. `Import.aggregate.ts` is 725 lines and
   `Deciding.decision.ts` 451 because each holds its commands, their events and their rejections.
2. **A decision's file takes its command's stem.** The library names a decision by its command's tag
   (`Decision.ts:402`: `decisionName = command.tag`), so `DecideGroup.command.ts` and `DecideGroup.decision.ts` are
   one unit by the library's own account. The class keeps its name, `DecidingGroup`.

What a command file would be (a sketch; the fields are the ones in `DecidingGroup.decision.ts` today):

```ts
// Review/DecideGroup.command.ts
import * as Domain from "@alchemy.run/domain"
import { Session } from "../Actor/Session.middleware.ts"
import { GroupDecided } from "../Group/Group.aggregate.ts"
import { ConfirmedSince, GroupCounted, MatchedSince, NotOpen, NotPermitted, ReviewMovedOn } from "../Import/..."

export class StepTaken extends Domain.Rejection("StepTaken", {}, { description: "..." }) {}

export class DecideGroup extends Domain.Command(
  "DecideGroup",
  {
    middleware: [Session],
    input: { importId: ImportKey, step: Step /* ... */ },
    events: [GroupDecided, GroupCounted],
    rejects: [NotOpen, NotPermitted, StepTaken, ConfirmedSince, ReviewMovedOn, MatchedSince]
  },
  { description: "Decide a group of rows as one act, from a screen that has every change of the import" }
) {}
```

`DecideGroup.decision.ts` then holds `DecidingGroup` alone: `reads`, `keyOf`, `decide` and its transitions.

### Where implementations go

I would not give every block a `.handler.ts` twin. In beep-effect the handler was split from the contract because it
imports reader services a client must never load. A model package may import only the library and `effect`, so a
`XLive` beside its declaration cannot pull a driver in; the library's layout keeps it there for that reason, and the
code that does need a driver already goes to `host` as an `.adapter.ts`. The package boundary is the second door.

What I would take from the handler files is the type check. When a handler is long enough to live apart, it is
written against its declaration, never against hand-copied types:

```ts
const handle = (({ source, event }) => /* ... */) satisfies Policy.Handler<Policy.TriggerOf<typeof ItemsWritten>>
```

`Handler` and `TriggerOf` are exported from the library's `src/Policy.ts`; I did not confirm the root `Domain.Policy`
namespace re-exports them.

### What stays as it is in beep-effect

The RPC shape is right for RPCs. An RPC has exactly one payload, one success and one failure, and nothing else in
the repository refers to them by name. Uniform slot names fit a unit with fixed slots; a tag-equal name fits a word
of the model. Both are one rule: name a thing by what the rest of the code calls it.

## What I would try first

Three experiments, each a folder under `scratchpad/experiments/`, before any file in `packages/` moves:

1. **A command in its own file, under the prover. Run on 2026-11-27: it holds.**
   `scratchpad/experiments/command-file` proves three copies of `Import` with `Prove.report`: as it is, with
   `MatchColumn` and its event in `MatchColumn.command.ts`, and with that command's `decide` moved there too. All
   three stand the same, 210 lines each, every rule proved for every command. A check deleted from the moved `decide`
   was caught (`AMatchIsMadeOnTheLastOne` no longer proved), so the prover reads a `decide` in another file. What it
   cost, and what it did not cover:
   - The rejections a command shares leave the aggregate's file with it, or the two files import each other.
   - A `decide` moves only with the state, which then needs a file of its own (`Import.state.ts`): a kind
     `block-files` has no ending for.
   - 60 of the model's 192 mutants name `src/Import/Import.aggregate.ts`, an anchor and a line's exact text. Moving a
     command and its event leaves them alone; moving a `decide` means writing them again.
   - The whole model, run the same day: a copy of the twelve files `Catalog.model.ts` reaches, with that change and
     the four decisions importing the moved names from their new files, is verified against a copy of the package's
     lock exactly as the unchanged copy is (nothing undone, nothing relocked, 134 rules required proved, three
     commands deep, `CI=true`).
   - Not run: the stories, and the laws on the new files. The experiment's `NOTE.md` has the detail.
2. **Export keys that carry the path and the kind.** One package, read by bun, `tsrs`, Vite and the prover. Not
   run. Experiment 3 gives its size for the two contexts: 150 export keys and 312 import statements, all rewritten.
   The doors it was meant to make checkable are checkable without it, by resolving each import through the
   package's `exports`, which is what experiment 3 does.
3. **The registry reading today's tree. Run on 2026-11-27: sixteen files of 173.**
   `scratchpad/experiments/kind-registry` holds the registry as data (28 kinds) and reads the eight packages of the
   catalog and access contexts. It refuses nine files that take another kind's name (eight `.store.ts` and one
   `.gateway.ts`, all ports), four with no ending (`Host.ts` twice, `Adapters.ts`, `Config.ts`) and three endings used
   once (`.reference`, `.state`, `.route`). The doors hold already: of 269 imports that load code from one of those
   packages, none is a screen loading a port, a handler or an in-memory twin. It reads endings and layers, not what a
   file declares. The other packages, where most one-off endings are, were not read.

## Questions for Benjamin

Five, in [DECISIONS.md](DECISIONS.md). He answered four on 2026-11-27, each as recommended: one command to a
`.command.ts` with its `decide` left where it is; one registry of kinds for every layer of a context; one ending for
a port; and export keys left as they are, which sets aside what "The doors are kinds" above proposes for them. Open:
whether a block's name, tag and stem being equal is a law.

## Trail

- 2026-11-27: opened from his question. Read the library's layout and building-block references, the prover's
  resolver and loader, `laws block-files`, and `packages/catalog/model`.
- 2026-11-27: he chose experiment 1. `scratchpad/experiments/command-file`: a command, its event and its `decide` in
  a file of their own prove exactly as the baseline does, and a broken moved `decide` is caught. He then chose the
  whole model: verified against the package's lock with the split, as without it.
- 2026-11-27: he chose experiment 3. `scratchpad/experiments/kind-registry`: sixteen of 173 files refused, no closed
  door crossed, and the doors checkable through `exports` without changing a key.
- 2026-11-27: `DECISIONS.md` written with five decisions; he answered 1, 3, 4 and 5, each as recommended. Nothing in
  `packages/` has moved, and no brief is written.
- 2026-11-27: [BRIEF.md](BRIEF.md) written for one goal, `module-kinds`. It awaits his word that it matches.
- 2026-11-27: he asked which of the experiment's five copies is best: `split`. It had been proved on the `Import`
  aggregate only, so a sixth copy, `model-split-command`, put it under the whole model's verify: verified against
  the package's lock, the lock unchanged.
- 2026-11-27: he said the brief matches, and asked for the packet committed.
- 2026-11-27: he asked whether an event could carry its own `evolve` (`GroupDecided: GroupDecided.evolve`), and
  rules and decisions likewise. Tried on `Import`: as a static of the event's class the prover does not read it (27
  rules `NotTranslated`); as an exported function beside the event it stands as the baseline. Not a decision yet.
- 2026-11-27: he asked for the full shape, then for one module to read. `scratchpad/experiments/import-module`: the
  `Import` aggregate as twelve files, each `evolve` beside its event, each `decide` beside its command, the
  invariants with the state. It proves as the package's file does and the whole model verifies against the unchanged
  lock. The transitions stay in the aggregate's file: moved, the lock refuses all 23. An `evolve` as a static of
  its event's class, which he asked for twice, is not read by the prover. This shape is not decision 1 as he answered
  it ("decide stays"); he has not been asked to change it.
- 2026-11-27: he chose to size the prover change. About forty lines of the built interpreter, tried on a copy of the
  library: with them `ColumnMatched: ColumnMatched.evolve` proves as the baseline does, and a broken static is
  caught. `scratchpad/experiments/command-file/prover-static-member.patch`. Nothing in `node_modules` or
  `packages/patches` was changed.
- 2026-11-27: statics on the whole module, as he chose: with the changed prover it proves and the whole model
  verifies. He then proposed reading each command's file as a namespace instead, as Effect's modules are read
  (`StageImport.decide`, `StageImport.evolve`, `StageImport.StageImport`). That needs no change to the prover: proved,
  and the whole model verified against the unchanged lock. `import-module` is now in that form.
