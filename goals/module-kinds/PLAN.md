---
type: Plan
title: "Module kinds, plan"
description: "The steps of the module kinds goal in the order the brief's Map gives, each with what it is built on, what gates it and its status; steps 8 and 9 wait on Benjamin's word about the order with alchemy-domain-uptake."
from: explorations/module-taxonomy
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance. A step is one part of
[the brief's](../../explorations/module-taxonomy/BRIEF.md) Map. Status is one of `todo`, `doing`, `done`, `closed`
(tried, did not hold up, with the reason). The packet was written on 2026-11-27; steps 1 to 3 were built the same
day, and steps 5 and 6 after them.

| # | Step | Built on | Needs first | Status |
| --- | --- | --- | --- | --- |
| 1 | The registry as a schema and a table | NET-NEW in `packages/tooling/tool/cli/src/commands/Laws/`; the cut in `scratchpad/experiments/kind-registry/Kinds.registry.ts` | nothing | done |
| 2 | `block-files` reads the registry | `BlockFiles.rules.ts` and `test/BlockFiles.test.ts` | step 1 | done |
| 3 | Nine ports renamed to `.port.ts`, with their export entries and imports | the eight `.store.ts` files of the two models and `ModelAllowance.gateway.ts` | step 2 | done |
| 4 | `boundaries` asks the registry the kind of each import | `Boundaries.rules.ts`; `scratchpad/experiments/kind-registry/KindRegistry.test.ts` | steps 1 to 3 merged | todo |
| 5 | `.event.ts`, `.state.ts`, `.transition.ts` and `.union.ts` as kinds; decision 2's three checks; decision 8's count | `Kinds.registry.ts`, `BlockFiles.rules.ts` | step 2 | done |
| 6 | The kinds of decisions 6, 7 and 9 to 11 in the registry (`.config.ts`, `.route.ts`, `.sealed.ts`, `.host.ts`, `.cron.ts`, `.singleton.ts`, a surface's four); `.handler.ts` and `.live.ts` retired; a model's merged Live in `<Model>.model.ts` | `Kinds.registry.ts`; the brief's placement table | step 2; before `alchemy-domain-uptake` builds the first of them | done |
| 7 | `Host.ts` to `<Model>.host.ts` in both hosts, `Config.ts` to `Auth.config.ts`, `Adapters.ts` into the host file, `ItemsOfRow.reference.ts` to `.context.ts` | `packages/access/host/src`, `packages/catalog/model/src/Review` | step 6 | todo |
| 8 | Every block of `Import` in a file of its kind, read as a namespace; the 60 mutants written again | `Import.aggregate.ts`; `scratchpad/experiments/catalog-model/model/Import` | step 5; **Benjamin's**: the order with `alchemy-domain-uptake` | todo |
| 9 | The same for `Row`, `Group` and the four decisions | `Row.aggregate.ts`, `Group.aggregate.ts`, `Review/*.decision.ts`; `catalog-model/model` | step 8 | todo |

## First slice

Steps 1 to 3, one pull request. It changes no code a proof reads, and `bun run check` holds it. Sixteen of the two
contexts' 173 files are refused by the experiment's registry today: the nine ports, the four with no ending and the
three endings used once. Step 3 clears nine; steps 6 and 7 clear the rest, so until step 7 the registry lists the
seven by name as known exceptions.

## Choices made in the first slice

- **The registry is `packages/tooling/tool/cli/src/commands/Laws/Kinds.schema.ts`**, 37 kinds by ending: the
  experiment's 28 and the nine blocks `block-files` already placed (view, query, projection, stream, policy, saga,
  external, rewrite, compaction). Each row is a `Kind` with what it declares, who holds it, who imports it, and for an
  ending that names a block: what declares it, whether the file must declare it, and what else the file may hold.
- **`block-files` derives five of its six tables from the registry** (`placed`, `reserved`, `holds`, `besideItsOwn`,
  `homes`, and `declarers` but for two lines). An event and a relation have no ending yet, so what declares them
  stays in the law until step 5 gives an event one.
- **A command's and an external system's row is held by a contract too**, as decision 32 of `alchemy-domain` keeps
  both endings there. The experiment's table had them in the model only.
- **Who imports a kind is data nobody reads yet.** Step 4 reads it. A policy, a saga, a projection, a rewrite, a
  compaction and an external system are closed to a screen there; a view, a query and a stream are open. The agent's
  call, his to overturn before step 4.
- **Seven files wait, listed by path in the registry** with the step that clears each: `Host.ts` in both hosts,
  access's `Adapters.ts`, `Config.ts` and `SignIn.route.ts`, `ItemEditor.state.ts`, `ItemsOfRow.reference.ts`.
- **Two refusals are new to the old fixtures**: a contract's `.view.ts` and a model's `.test-layer.ts` are each a
  kind of another layer. No file of the repository was either.
- **The export keys did not change** (decision 5): each of the nine keys names the same thing at its file's new
  path. The ontology's enrolment names `ModelAllowance.port.ts` by path and was rewritten with it.

## Choices made in steps 5 and 6

- **Fifty kinds.** Step 5 adds `event`, `state`, `transition`, `union` and `sealed`; step 6 adds `host`, `cron`,
  `singleton`, `cli`, `toolkit`, `mcp`, `route` and `config`. `ItemEditor.state.ts` and `SignIn.route.ts` are held
  now, so five files wait, all for step 7.
- **Decision 2's three checks** hold of any file ending `.event.ts` or `.command.ts`: the block's tag is the stem,
  the block is exported as `Event` or `Command`, a model's file exports `evolve` or `decide`. A contract's command
  needs no `decide`. No file of the four layers picks `Event` or `Command` by name out of such a file, a type
  included. The helper a command's file may also export is not refused, since the law asks for names and forbids
  none.
- **The allowance stays**, as the brief's rabbit hole says: an event or a command in its decider's file is still
  kept, and no file of the packages has either ending yet. A misplaced event is now sent to `<Tag>.event.ts`, no
  longer to its command's file. Step 9 takes the allowance out.
- **Decision 8a's count** is on the two kinds the registry gives a folder, a command and an event: more than five
  in a module outside `commands/` or `events/` is refused, and so is such a folder with five or fewer.
- **`.live.ts` is refused as no kind. `.handler.ts` keeps its row**: ten files of the packages are the endpoint
  handlers it names, and they go when `alchemy-domain-uptake` replaces them. Nothing can tell a block's Live written
  in a `.handler.ts` from those by its name, so that half of the retirement is held by review until then.
- **A model's merged Live in `<Model>.model.ts`** is written into the `model` row's description. No package has a
  Live yet, so no check reads it.
- **The law was run on the experiment's model**, copied into a throwaway package: 67 files, all held, with its
  `Import/commands/` of seven and `Import/events/` of nine.
- **Tests are not read**, as before: a test that picks `Event` by name is not refused.

## Benjamin's

- **Before step 8: which goal moves `packages/catalog/model` first.** `alchemy-domain-uptake` is open on that
  package (its move 3 writes the import's commands). Moving the files first means its briefs are written against
  the new homes; moving them after means every block it adds is moved once more. Steps 1 to 7 do not wait on this.

## What the experiment left unchecked

- The saga's "a defect ends it `Died`" has no story; the check for "an act has reached this row" is written two
  ways; `under` could fold into the `act` field record. None touches a package file this goal moves.
