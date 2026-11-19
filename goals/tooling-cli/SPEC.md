---
type: Goal
title: "tooling-cli"
description: A repository CLI package, @beep/repo-cli at packages/tooling/tool/cli, as beep-effect has, and the ten scripts under scripts/ ported to typed Effect commands on it with their behaviour and failure sentences unchanged.
status: done
from: explorations/ideal-architecture
---

# `tooling-cli`

Outside the nine steps of [the ideal-architecture exploration](../../explorations/ideal-architecture/README.md). The
design is [BRIEF-tooling-cli.md](../../explorations/ideal-architecture/BRIEF-tooling-cli.md); the rules the package
follows are [docs/standards/schema-first.md](../../docs/standards/schema-first.md) and
[docs/standards/effect-imports.md](../../docs/standards/effect-imports.md).

## Objective

The repository's own rules run as commands of one package, `@beep/repo-cli`, type-checked under the full profile and
tested, and `scripts/` no longer holds them. `bun run check` and `bun run check:full` run the same rules under the
same root script names and turbo task names, and print the same sentences.

## Non-goals

No new rule and no change to what a rule accepts or says, except the one row that lets nothing but the root depend
on the new package. The app's own scripts under `apps/inventory/scripts/` stay. No compiled binary, no build, no
publishing, none of beep-effect's other command groups or support packages. The vendored kit is never edited.

## Constraints

- Each port is proved before its script is deleted: old and new on the unchanged tree, then on one planted violation
  for every kind of failure the script can print, with standard output, standard error and exit code compared byte
  for byte. The script is deleted in the commit that moves its callers.
- `bun run check:full` green at every commit.
- Effect 4.1.4 only, every API checked in `node_modules/effect`; the CLI module is `effect/cli/Command` and
  `effect/cli/Flag`; bun runs it with `@effect/platform-bun` 4.1.4 (decision T2).
- The full type-check profile with no override and no ceiling file; a role suffix in every filename outside
  `internal/`, `index.ts` and `bin.ts`; exact exports; typed errors.
- Root `package.json`, `turbo.json` and the lockfile are shared with another branch: edits there are minimal.
- bun only; nothing pushed.

## Acceptance

- [x] `@effect/platform-bun` 4.1.4 installs and a command runs on it: `bun run beep quality ceilings`.
- [x] `quality ceilings`, `laws exports`, `laws boundaries`, `laws screens`, `laws keys`, `vendor check`,
      `docs check`, `quality strict`, `vendor sync` and `laws effect-imports` each proved equal to its script and
      that script deleted: [PLAN](PLAN.md) records each proof.
- [x] Every rule has tests from its planted violations: `bun run --cwd packages/tooling/tool/cli test`.
- [x] A test fails when a command that does nothing takes longer than the budget set from the first real
      measurement.
- [x] `scripts/` holds no rule; `bun run check:full` passes; the check's time before and after is in the plan.

## Decisions

In [DECISIONS.md](../../explorations/ideal-architecture/DECISIONS.md): "tooling CLI: the package" (T1), "what runs
it" (T2), "command groups" (T3), "vendoring commands" (T4), "when the scripts go" (T5 and T6), "the calls every
package makes" (T7), "what the tests stand on" (T8), and "the tooling CLI brief".
