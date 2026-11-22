---
type: Tooling Guide
title: Trying an idea in the scratchpad
description: How to try an idea against the repository's own packages without touching them: one folder for each experiment, from a template whose test already runs, apart from the check, the build and a deploy, and ended by graduating its code into a package or dropping it.
tags: [tooling, experiments, scratchpad]
---

# Trying an idea in the scratchpad

`scratchpad/` is a workspace package that can import every package of the repository. An idea is tried there in a
folder of its own, with a test, and nothing else reads it: not `bun run check`, not the build, not a deploy, not CI.
A broken experiment breaks nothing. The price of that freedom is that an experiment ends: its code graduates into a
package, where every rule applies, or it is dropped, and one line of what it taught stays.

## From an idea to its end

```sh
bun run scratch:new stock-count --template service --question "Can a count be kept once per shelf?"
bun run scratch:test stock-count      # its test passes as written; change it and run again
bun run scratch:check                 # the type-checker and the Effect diagnostics, over every experiment
bun run scratch:list                  # what is open, how old, how large
bun run scratch:graduate stock-count --to packages/catalog/model/src/StockCount.rules.ts --learned "One count per shelf needs the shelf in the key."
bun run scratch:drop stock-count --learned "The table library already does this."
```

| Command | What it does |
| --- | --- |
| `bun run scratch:new <name> --template <template>` | Writes `scratchpad/experiments/<name>/` from a template, with a `NOTE.md`. The name is small letters, digits and hyphens. `--question` puts the question in the note |
| `bun run scratch:test [name]` | The experiments' tests, on Node as the repository's tests run (Vitest with `@effect/vitest`); with a name, only that experiment's |
| `bun run scratch:check` | No install inside an experiment, a note for each, every dependency accounted for; then the type-checker with the Effect diagnostics over all of them |
| `bun run scratch:list` | The open experiments with their age and size, the ones past a limit, and the log of the ended ones |
| `bun run scratch:serve experiments/<name>` | A screen experiment's page on http://localhost:5273 |
| `bun run scratch:graduate <name> --to <path> --learned "<one line>"` | The code has moved into a package: deletes the folder, removes the libraries only it named, appends the line to `scratchpad/LOG.md` |
| `bun run scratch:drop <name> --learned "<one line>"` | The idea is not pursued: the same, without a place |

## The four starting points

Each is a few files and a test that passes as written. A test in the repository's CLI makes each one and runs the
real test runner and type-checker over it, so a template that stops working fails `bun run check:full`.

| Template | What it gives |
| --- | --- |
| `probe` | A plain function, the same as an Effect, and a test of both. It imports `@inventory/kernel/Role`, to show that any package is imported by its name |
| `service` | A `Context.Service`, its twin for tests with everything in memory, something that uses it, and a test through the twin |
| `screen` | A page of its own (`index.html`, `main.tsx`), a screen from the design system's components over atoms, and a test of the atoms. Served by `scratch:serve`; the app never loads it |
| `verify` | An aggregate the prover reads (`<Name>.aggregate.ts`), a story that runs its model and a proof of its rules. It needs `@alchemy.run/domain`: until `vendor/alchemy/sources.json` lists that package, `scratch:new` refuses this template and says so; once it does, the package is added as the experiment's own library. The aggregate's file builds events with `new` and turns the one diagnostic that refuses it off on its first lines, because the prover does not read `X.make(...)` |

## What is and is not enforced inside it

- **On, in `scratch:check`:** the type-checker with the repository's whole Effect profile (`tsconfig.base.json`, nothing
  turned off). What it says of an experiment is what it would say of a package.
- **Not enforced inside:** the laws on how code is written (no `_tag` told apart by hand, the form of an Effect
  import, a ref that stays the same across draws) and the linter. Each of those laws names the scratchpad as left
  out. They apply the moment code graduates into a package, so write an experiment the way a package is written when
  you mean to keep it.
- **Still refused:** a secret. `bun run check` reads every file git would commit for key-shaped strings, the
  experiments too, because the repository is public. Use no real customer data and no private name in an experiment
  for the same reason.
- **Never the other way:** nothing imports from the scratchpad. `bun run check` refuses a package.json (a
  workspace's or the root's) that declares it or maps a `#` import into it, and any file that reaches it: by its
  name, by a path, by an alias that climbs into it (`@/../../scratchpad/...`), through `import.meta.glob`, or a
  stylesheet's `@import` or `@source`. It reads each workspace's code, scripts, root files and stylesheets, and the
  files at the repository's root (`alchemy.run.ts`, what a deploy runs). A path built at run time is not seen
  (`bun run beep laws boundaries`). That is the one thing the check enforces about it.

## Staying small

- **One folder, one note.** `NOTE.md` starts with `status: open`, the day it started, its template and the libraries
  only it needs. An experiment that ended has no folder; its line in `scratchpad/LOG.md` says whether it graduated
  and where to, or was dropped.
- **No install of its own.** A `package.json`, a lockfile or a `node_modules` inside an experiment fails
  `scratch:check`. That is how a scratchpad becomes a second repository.
- **A library only an experiment needs** goes in the scratchpad's `package.json`
  (`bun add --cwd scratchpad <name>`) and in the experiment's note (`libraries: <name>`). It never goes in the app or
  a package. `bun run deps:update` leaves it alone, and ending the experiment removes it unless another experiment
  names it too.
- **Graduate or delete.** Graduating does not move code: move it into a package first, make `bun run check` pass
  there, then graduate, in the same change.
- **A warning, not a failure:** `scratch:list` names an experiment older than 30 days or larger than 200 files.
- **State stays out of git and off the app's port.** A database or a dev server's cache goes in a `.state` folder
  (ignored), and a server takes its own port (5273 for a screen), never the app's 5173.

Trial code written while building something belongs here too, not in a cache folder: it is type-checked, it can
import the packages, and `scratch:list` shows that it is still there.

## What the rest of the repository does with it

- The scratchpad depends on every package under `packages/`; `bun run config-sync` writes that list, so a new
  package is importable without anyone remembering, and `config-sync:check` fails when it is missing.
- What it shares with the packages (`effect`, the test runner, React) is held at the packages' versions by
  `bun run version-sync`. syncpack does not read it.
- Turbo runs no task in it: it has no `check`, `lint`, `test` or `build` script. An edit inside an experiment changes
  the cache key of one task only, `keys:check`, which reads it for secrets. The formatter skips
  `scratchpad/experiments`.
