---
type: Goal
title: Workspace and strictness
description: Clear the timed-build tooling, move the app into a bun + Turborepo workspace, and adopt beep-effect's compiler and Effect diagnostic profile in stages.
status: active
from: explorations/ideal-architecture
---

# Workspace and strictness

Steps 0, 1 and 2 of the order of work in
[the ideal-architecture exploration](../../explorations/ideal-architecture/README.md), argued in
[research 04](../../explorations/ideal-architecture/research/04-beep-direction.md) sections 5 to 8.

## Objective

The repository describes itself as it now is: an inventory import app, built with bun and Turborepo, with the app in
`apps/inventory`, and type-checked under beep-effect's flags and Effect diagnostic severities, with every exception
written down and counted. A person importing `items_messy.csv` sees exactly what they saw before.

## Non-goals

- No new packages beside `apps/inventory`: the vendored kit, `@beep/csv`, kernel, drivers, UI packages, the `access`
  and `catalog` contexts, `@beep/xlsx` and `@beep/infra` are later goals.
- No change to what the app does, says or stores.
- No remote Turborepo cache and no `--affected` runs.
- No deploy, no push.

## Constraints

- The app keeps working at every commit: the sample `public/samples/items_messy.csv` (200 rows) imports to 155
  stored, and the result screen, the Items table and the stored rows agree.
- bun is the only package manager.
- Effect v4 only; any Effect API touched is checked against Effect's source.
- Code rewritten in this goal uses `Effect.fn`/`Effect.fnUntraced` and Effect's `HashMap`/`HashSet`, never a plain
  `Map` or `Set`.
- The vendored `components/ui` is not rewritten (regenerating it from a registry would undo local edits).

## Acceptance

Step 0, clear the ground:

- [ ] No timed-build tooling is left: `git grep -nE 'clock|checkpoint|session-log|session-report|check-images|pack\.sh'`
      over `package.json`, `scripts/`, `test/` and `.claude/` finds nothing.
- [ ] No hook calls a missing script: `.claude/settings.json` has no `hooks` entry naming a file that does not exist.
- [ ] No starter placeholder name is left: `git grep -niw takehome` finds nothing outside git history.
- [ ] `packageManager` names bun and `package-lock.json` is gone (`git ls-files package-lock.json` is empty).
- [ ] `bun run check:full` and `bun run build` pass.
- [ ] Browser: `items_messy.csv` imported through Confirm; rows in the file, the result screen and the stored count
      agree (200 rows, 155 stored).

Step 1, workspace:

- [ ] The app lives in `apps/inventory`; the root `package.json` declares bun workspaces and `turbo.json` has the
      seven package tasks and two root tasks.
- [ ] `bun run check:full` (through `turbo`) passes, and a second `bunx turbo run check` reports every task cached
      (`FULL TURBO`).
- [ ] The production CSS still contains a class used only in `components/ui` (named in PLAN with the command).
- [ ] `.github/workflows/ci.yml` calls turbo through the root scripts.
- [ ] `bun run docs:check` validates `docs/`, `explorations/` and `goals/`.
- [ ] Browser: the same import, three numbers agreeing.

Step 2, toolchain:

- [ ] `tsconfig.base.json` holds beep-effect's compiler flags and Effect language-service severities, with the
      beep-effect commit noted in a comment; `@effect/tsgo` and `tsrs` are pinned to the versions in research 04
      section 5.
- [ ] Server, api, domain and test code pass the full profile with no override.
- [ ] Own web code passes with one commented override for `preferEffectArray`, `preferEffectString`,
      `preferEffectRecord` and `missingPipeableSignature`; its error count is recorded as a ceiling, and
      `bun run check:strict` fails when the count rises above it.
- [ ] `components/ui` is excluded and recorded as a permanent exception.
- [ ] `bun run check:full` and the production build pass.
- [ ] Browser: the same import, three numbers agreeing.

## Decisions

From [the exploration's DECISIONS](../../explorations/ideal-architecture/DECISIONS.md), answered 2026-11-18:
"step 0" (what is cleared, the cookie rename), "strictness" (stages A to D), "packages" (`@beep/*` and
`@inventory/*` scopes). Recommendations taken here where no answered decision settles the point are listed in
[PLAN](PLAN.md) under "Choices made".
