---
type: Brief
title: "Brief: module-kinds"
description: The goal module-kinds. One registry of file kinds that the repository's laws read, for the four layers of a context; a port under one ending; and each command of the catalog's model in a file of its own.
---

# Brief: `module-kinds`

Benjamin's words, 2026-11-27: "following the principles of what we've just done with Rpcs could achieve an extremely
consistent module structure & taxonomy throughout a repo." The reading is [the README](README.md); his answers are in
[DECISIONS.md](DECISIONS.md), and this brief is built on decisions 1, 3, 4 and 5 as he answered them.

Nothing here is built. No file in `packages/` or `apps/` has changed and no goal is open. Every number was measured on
this repository at `a184783d` by the two experiments under `scratchpad/experiments/`.

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
  thirteen rejections above the aggregate. The library's layout gives each command a file.

## Appetite

Scope, not time. In:

- The registry as a schema and a table in `packages/tooling/tool/cli`, and `laws block-files` and `laws boundaries`
  reading it for `contract`, `model`, `host` and `web`.
- The nine port files renamed to `.port.ts`, with their export entries and imports.
- Each command of the catalog's model moved to a `.command.ts` with its events and the rejections only it returns,
  and each shared rejection to a `.rejection.ts`. `decide` stays where it is.
- An ending for each of the four files that have none and a kind or a rename for each of the three one-off endings,
  once he has answered what they are (decisions 6 and 7).

Out:

- Any change to what the code does, to a rule of the model, or to a sentence a person reads.
- Export keys (decision 5: "Leave them").
- The packages outside a context: the kernel, the drivers, the client, the review package, infra, the CLI, the app.
- Splitting the 23 `.rules.ts` files of the two models by what each is.
- Moving a `decide`, or the state, out of an aggregate's file (decision 1: "Own file, decide stays").

## Sketch

**The registry.** One record by ending. Each kind says what the file declares, which layers may hold it and which
layers may import it from another package; an ending may be named as another kind's until its files are renamed.
`scratchpad/experiments/kind-registry/Kinds.registry.ts` is a first cut with 28 kinds; its `classify` and `doorOpen`
are the two questions the laws ask.

**The laws.** `block-files` keeps its own reading of what a file declares, from the syntax tree, and takes the list
of endings and layers from the registry instead of its six tables. `boundaries` resolves each import of a context's
package through that package's `exports` to a file, and asks the registry whether the importer's layer may load that
kind. The experiment's test does both readings over the real tree in under a second.

**Commands.** For each aggregate and decision of `packages/catalog/model`: the command, the events it records and the
rejections only it returns move to `<Command>.command.ts` beside it; a rejection several commands return moves to
`<Name>.rejection.ts`. The decider's file imports them and keeps its state, its rules, `evolve` and `decide`. The
unions the prover reads (`ImportCommand`, `ImportEvent`) stay exported from the aggregate's file. Tried on a copy of
the whole model with `MatchColumn`, in exactly this shape (`model-split-command`): verified against the package's
lock, the lock unchanged (`scratchpad/experiments/command-file`).

## Rabbit holes

- **The uptake goal moves the same files.** `goals/alchemy-domain-uptake` rewrites handlers, stores and adapters into
  blocks of the library: a `.store.ts` renamed here may be a projection's port or gone there. The port renames go
  first or wait for the move that touches each file; they never run beside it.
- **`block-files` allows a command in its decider's file.** Once the commands have moved, that allowance is taken
  out, or the two places drift apart again.
- **`laws model-inputs`.** Every file a model, an aggregate or a decision imports must be an input of the package's
  `verify`, `prove` and mutant tasks. Each new `.command.ts` and `.rejection.ts` is one.
- **The mutants.** Each names a file, an anchor and a line's exact text. None anchors on a command's or an event's
  declaration that I found, but the 192 were not all read: run `mutants:sample` after the first aggregate moves.
- **Export entries.** Exports are exact, one entry a file. A command another package imports today through
  `./ImportAggregate` needs an entry of its own, or that package's imports change.
- **`.rules.ts`.** The registry holds it as one kind. Asking what each of the 23 is belongs to another goal.
- **The table of who holds what was written from today's tree.** It refuses no file for its layer by construction.
  Before it is a law, each row is read against what the layer is for, not against what is there.

## No-gos

- No uniform export names (`Contract`, `Handler`, `Payload`) for blocks, and no folder or `index.ts` for one block.
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
| Commands of the catalog's model in files of their own | `module-kinds`, later, when decision 2 is answered and no move of `alchemy-domain-uptake` is open on `packages/catalog/model` | `packages/catalog/model/src/Import/Import.aggregate.ts`, the four `Review/*.decision.ts`; `scratchpad/experiments/command-file` |
| The four files with no ending and the three one-off endings | `module-kinds`, later, when decisions 6 and 7 are answered | `packages/*/host/src/Host.ts`, `packages/access/host/src/Adapters.ts` and `Config.ts`; `ItemsOfRow.reference.ts`, `ItemEditor.state.ts`, `SignIn.route.ts` |
| The registry for packages outside a context | not this goal | NET-NEW; needs the census first |

The first slice is the registry, `block-files` reading it, and the nine renames: it changes no code a proof reads,
and `bun run check` holds it.
