---
type: Goal
title: "Module kinds"
description: "One structure for the files of a context: a registry of kinds that the laws read, a port under one ending, and every block of the catalog model in a file of its kind read as a namespace, with no change to what the code does and the model's lock left byte for byte as it is."
status: active
from: explorations/module-taxonomy
---

# Module kinds

Benjamin asked, on 2026-11-27, whether the per-unit module shape tried on RPCs gives the blocks of
`@alchemy.run/domain`, and the rest of this repository, one consistent structure. The exploration answered with a
reading, a registry tried on the two contexts' 173 files, and the whole catalog model written to the shape in
`scratchpad/experiments/catalog-model`, where it verifies against the package's lock. He answered decisions 1 to 13
and chose to graduate ([DECISIONS](../../explorations/module-taxonomy/DECISIONS.md), 2026-11-27).

[The brief](../../explorations/module-taxonomy/BRIEF.md) is the design. This packet holds only what done means and
the order of the work.

## Objective

Every file of a context's `contract`, `model`, `host` and `web` layer has an ending the registry knows, the laws
refuse one that does not, and each block of the catalog model sits in a file of its kind: an event with its
`evolve`, a command with its `decide`, a state, a transition, a union, each read as the brief's Sketch says. The
code does what it did before.

## Non-goals

- **Any change to what the code does**, to a rule of the model, or to a sentence a person reads.
- **Export keys** (decision 5: "Leave them").
- **Packages outside a context**: the kernel, the drivers, the client, the review package, infra, the CLI, the app.
  The registry gets no row for one until it has been counted.
- **Building a block of decisions 9 to 11.** [alchemy-domain-uptake](../alchemy-domain-uptake/SPEC.md) builds them,
  in the homes this goal's registry gives.
- **Splitting the 23 `.rules.ts` files** of the two models by what each is.
- **Removing patches `04` and `05`.** They go when the library keeps a named rule's text and reads a constructor
  default itself.

## Constraints

- **Answered decisions bind**, as written in the exploration's `DECISIONS.md`. Two parts, 9d and 11b, and decision
  2's allowance for a helper a rule calls, were placed by the agent and are his to overturn.
- **The lock does not change.** `packages/catalog/model/test/Catalog.lock.json` is byte for byte the same after
  every step. A run that needs `UPDATE_VERIFY_LOCK=1` is a failed step, and is put back.
- **No event or command moves before `block-files` holds decision 2's three checks**: the stem is the tag, a kind's
  export names, no named import of `Event` or `Command`.
- **No rename in a file another open goal is moving, in the same change.** `alchemy-domain-uptake` works in
  `packages/catalog/model`; steps 8 and 9 wait for his word on which goes first.
- **No folder for one block and no `index.ts`.** A folder is for a kind with more than five files in its module
  (decision 8).
- **The experiment is the pattern, not the source.** `scratchpad/experiments/catalog-model/model` is read beside
  the package's files; nothing is copied from the scratchpad into a package without the package's own checks
  passing on it.

## Acceptance

- [ ] The registry is a schema and a table in `packages/tooling/tool/cli`, and `bun run check` fails on a file of a
      context whose ending it does not know (a test in `packages/tooling/tool/cli/test` adds one and expects the
      refusal).
- [ ] No `.store.ts` or `.gateway.ts` file is left under `packages/*/model` or `packages/*/contract`:
      `find packages -name '*.store.ts' -o -name '*.gateway.ts'` prints nothing outside `node_modules`.
- [ ] `laws boundaries` refuses an import by the kind of the file it loads, with a test for one refused import.
- [ ] `laws block-files` refuses a named import of `Event` or `Command`, an event file whose stem is not its tag,
      and a module with more than five files of one kind outside a folder of that kind, each with a test.
- [ ] Every event, command, state, transition and union of `packages/catalog/model` is in a file of its kind, and
      `bun run --cwd packages/catalog/model verify` passes with the lock unchanged
      (`git diff --stat main -- packages/catalog/model/test/Catalog.lock.json` prints nothing).
- [ ] The model's mutants that name a moved line are written again and each is still caught
      (`bun run check:full`).
- [ ] `packages/access/host/src` has `Auth.config.ts` and no `Config.ts` or `Adapters.ts`, and
      `packages/catalog/model/src/Review/ItemsOfRow.context.ts` replaces the `.reference.ts` file.
- [ ] The messy sample imported through Confirm on a fresh database stores 155 items, seen on screen after step 9.
- [ ] `bun run check`, `bun run check:full` and `bun run docs:check` pass after each step.

## Decisions

- 2026-11-27: he chose "Graduate to an uptake goal" with every decision of the exploration answered.
- Decisions 1 to 13: [DECISIONS](../../explorations/module-taxonomy/DECISIONS.md).
