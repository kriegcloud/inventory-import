---
type: Plan
title: "Module kinds, plan"
description: "The steps of the module kinds goal in the order the brief's Map gives, each with what it is built on, what gates it and its status; steps 8 and 9 wait on Benjamin's word about the order with alchemy-domain-uptake."
from: explorations/module-taxonomy
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance. A step is one part of
[the brief's](../../explorations/module-taxonomy/BRIEF.md) Map. Status is one of `todo`, `doing`, `done`, `closed`
(tried, did not hold up, with the reason). The packet was written on 2026-11-27; nothing is built.

| # | Step | Built on | Needs first | Status |
| --- | --- | --- | --- | --- |
| 1 | The registry as a schema and a table | NET-NEW in `packages/tooling/tool/cli/src/commands/Laws/`; the cut in `scratchpad/experiments/kind-registry/Kinds.registry.ts` | nothing | todo |
| 2 | `block-files` reads the registry | `BlockFiles.rules.ts` and `test/BlockFiles.test.ts` | step 1 | todo |
| 3 | Nine ports renamed to `.port.ts`, with their export entries and imports | the eight `.store.ts` files of the two models and `ModelAllowance.gateway.ts` | step 2 | todo |
| 4 | `boundaries` asks the registry the kind of each import | `Boundaries.rules.ts`; `scratchpad/experiments/kind-registry/KindRegistry.test.ts` | steps 1 to 3 merged | todo |
| 5 | `.event.ts`, `.state.ts`, `.transition.ts` and `.union.ts` as kinds; decision 2's three checks; decision 8's count | `Kinds.registry.ts`, `BlockFiles.rules.ts` | step 2 | todo |
| 6 | The kinds of decisions 6, 7 and 9 to 11 in the registry (`.config.ts`, `.route.ts`, `.sealed.ts`, `.host.ts`, `.cron.ts`, `.singleton.ts`, a surface's four); `.handler.ts` and `.live.ts` retired; a model's merged Live in `<Model>.model.ts` | `Kinds.registry.ts`; the brief's placement table | step 2; before `alchemy-domain-uptake` builds the first of them | todo |
| 7 | `Config.ts` to `Auth.config.ts`, `Adapters.ts` into `Host.ts`, `ItemsOfRow.reference.ts` to `.context.ts` | `packages/access/host/src`, `packages/catalog/model/src/Review` | step 6 | todo |
| 8 | Every block of `Import` in a file of its kind, read as a namespace; the 60 mutants written again | `Import.aggregate.ts`; `scratchpad/experiments/catalog-model/model/Import` | step 5; **Benjamin's**: the order with `alchemy-domain-uptake` | todo |
| 9 | The same for `Row`, `Group` and the four decisions | `Row.aggregate.ts`, `Group.aggregate.ts`, `Review/*.decision.ts`; `catalog-model/model` | step 8 | todo |

## First slice

Steps 1 to 3, one pull request. It changes no code a proof reads, and `bun run check` holds it. Sixteen of the two
contexts' 173 files are refused by the experiment's registry today: the nine ports, the four with no ending and the
three endings used once. Step 3 clears nine; steps 6 and 7 clear the rest, so until step 7 the registry lists the
seven by name as known exceptions.

## Benjamin's

- **Before step 8: which goal moves `packages/catalog/model` first.** `alchemy-domain-uptake` is open on that
  package (its move 3 writes the import's commands). Moving the files first means its briefs are written against
  the new homes; moving them after means every block it adds is moved once more. Steps 1 to 7 do not wait on this.

## What the experiment left unchecked

- The registry laws were never run on the experiment's files.
- The saga's "a defect ends it `Died`" has no story; the check for "an act has reached this row" is written two
  ways; `under` could fold into the `act` field record. None touches a package file this goal moves.
