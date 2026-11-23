---
type: Tooling Guide
title: Trying an idea in the scratchpad
description: How to try an idea against the repository's own packages without touching them: one folder for each experiment, from a template whose test already runs, apart from the check, the build and a deploy, and ended by graduating its code into a package or dropping it.
tags: [tooling, experiments, scratchpad]
---

# Trying an idea in the scratchpad

`scratchpad/` is a folder beside the workspaces, not one of them, that can import every package of the repository:
bun keeps one `node_modules` at the root, which holds every package and every library, and an experiment imports
them from there. An idea is tried there in a
folder of its own, with a test. The build never reads an experiment, `bun run check` reads one only for what must
never be committed (a key, a home path) and for an import of it, and a broken experiment fails no check. What does
read the scratchpad today is listed at the end of this page. The price of that freedom is that an experiment ends: its code graduates into a
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
| `bun run scratch:test [name]` | The experiments' tests, on Node as the repository's tests run (Vitest with `@effect/vitest`); with a name, only that experiment's folder (`xlsx-dates` never runs `xlsx-dates-2`), and a named experiment with no test fails |
| `bun run scratch:check` | No install inside an experiment, a note for each, every dependency accounted for; then the type-checker with the Effect diagnostics over all of them |
| `bun run scratch:list` | The open experiments with their age and size, the ones past a limit, and the log of the ended ones |
| `bun run scratch:serve experiments/<name>` | A screen experiment's page, on the first free port from 5273 (so two can be served at once), with its cache in that experiment's `.state` |
| `bun run scratch:graduate <name> --to <path> --learned "<one line>"` | The code has moved into a package: deletes the folder, removes the libraries only it named, appends the line to `scratchpad/LOG.md` |
| `bun run scratch:drop <name> --learned "<one line>"` | The idea is not pursued: the same, without a place |

## The four starting points

Each is a few files and a test that passes as written. A test in the repository's CLI makes each one and runs the
real test runner and type-checker over it, so a template that stops working fails `bun run check:full`. The `verify`
template is in that test only once `@alchemy.run/domain` is installed at the root (a package asks for it); until then
the test's name says it was not run, and it was checked by hand.

| Template | What it gives |
| --- | --- |
| `probe` | A plain function, the same as an Effect, and a test of both. It imports `@inventory/kernel/Role`, to show that any package is imported by its name |
| `service` | A `Context.Service`, its twin for tests with everything in memory, something that uses it, and a test through the twin |
| `screen` | A page of its own (`index.html`, `main.tsx`), a screen from the design system's components over atoms, and a test of the atoms. Served by `scratch:serve`; the app never loads it |
| `verify` | An aggregate the prover reads (`<Name>.aggregate.ts`), a story that runs its model and a proof of its rules. It takes `@alchemy.run/domain` from the root's install: until a package asks for it, `scratch:new` refuses this template and says so. The prover knows an event or a rejection only by `new`, not by `X.make(...)`, so, as decision 33 of the Alchemy brief (2026-11-22, "`new` only in decide files") has it, a decide file (`*.aggregate.ts`, `*.decision.ts`) builds them with `new` and turns that one diagnostic off on its first line (`// @effect-diagnostics newSchemaClass:off`); every other file, the template's model and test included, builds with `.make`. The directive is allowed in the scratchpad only: once the experiment graduates into a package, `diagnostics:check` refuses it there. The model's decide files that hold it today are held in `packages/tooling/tool/cli/ledgers/diagnostics.json`, and a new decide file in a package builds with `.make` once the prover reads it (decision 33, in progress) |

## What is and is not enforced inside it

- **On, in `scratch:check`:** the type-checker with the repository's whole Effect profile (`tsconfig.base.json`, nothing
  turned off). What it says of an experiment is what it would say of a package. A file may turn one diagnostic off
  only as decision 33 of the Alchemy brief allows: `// @effect-diagnostics newSchemaClass:off` as the first line of a
  `*.aggregate.ts` or `*.decision.ts`, here and nowhere else: in a package `diagnostics:check` refuses every
  `@effect-diagnostics` comment, that one included. `scratch:check` refuses, with the file and line:
  - any other `@effect-diagnostics` line, wherever it stands (the checker reads it in a string too);
  - `@effect-leakable-service` and `@effect-expect-leaking`, the two comments that silence the `leakingRequirements`
    diagnostic, in any mix of capitals, wherever they stand;
  - a comment that starts with `@ts-nocheck` or `@ts-ignore`, in any mix of capitals, where the compiler reads one:
    `@ts-ignore` in a `//` comment or on the last line of a block comment, `@ts-nocheck` in a `//` comment. A string,
    a template, the text of a JSX element, a sentence that only names one, and a line of a doc comment that starts
    with one and is not its last are left alone, as the compiler leaves them. `@ts-expect-error`
    is allowed: it is how an experiment shows that a wrong call does not compile, and it fails by itself once the
    error is gone, where `@ts-ignore` would go on hiding it. Which stretches of a file are comments is a parser's
    answer (oxc-parser, the one the repository's laws read code with), not a guess from the characters around a
    slash; in a file the parser refuses, every line that names one of the two is refused until the file parses.

  It reads the files the compiler itself lists for the scratchpad's type-check (`tsrs -p tsconfig.json
  --listFilesOnly`): the experiments and the scratchpad's configuration, a file loose beside them or in a `dist`
  folder, a folder linked in, and every file one of those reaches by an import, whatever its folder is called and
  whether or not it is in the scratchpad. A list without the scratchpad's own `vite.config.ts` and `vitest.config.ts`
  is not the compiler's whole list, and the check fails and says so. Left alone are a file of an installed library
  (under a `node_modules`, in a folder with a package.json), a file one of the repository's workspaces includes in a
  project of its own (the `include` of a tsconfig file in its folder: `src` and `test` for most), which that
  package's own check holds, and a file the compiler never loads (JavaScript, or a cache nothing imports). A file
  somebody wrote in a folder named `node_modules`, beside a package.json that is no workspace's, or in a workspace's
  folder where none of its projects reads (a `test` folder of a package with no test project), is read.

  The scratchpad's `types`, `tests` and `serve` scripts are the CLI's as well: the type-check and the compiler's
  list both run through `bun run types`, so `scratch:check` fails on a script that says anything else.
- **Not enforced inside:** the laws on how code is written (no `_tag` told apart by hand, the form of an Effect
  import, a ref that stays the same across draws) and the linter. Each of those laws names the scratchpad as left
  out. They apply the moment code graduates into a package, so write an experiment the way a package is written when
  you mean to keep it.
- **Still refused:** a secret, and a path that names a person's machine. `bun run check` reads every file git would
  commit for key-shaped strings, the experiments too (`keys:check`), and every file of the scratchpad for an absolute
  home path (`/home/<name>/`, `/Users/<name>/`, `C:\Users\<name>`) or a folder kept outside the repository
  (`~/.claude`, `.config/Claude`) (`private-paths:check`). Each names the file and line, never what it found, because
  the repository and its CI logs are public. Use no real customer data and no private name in an experiment
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
- **A library only an experiment needs** goes in the scratchpad's own `package.json`
  (`bun add --cwd scratchpad <name>`), installed in `scratchpad/node_modules` with the scratchpad's own lockfile,
  `scratchpad/bun.lock`, which is committed (bun writes it with the first library), and in the experiment's note
  (`libraries: <name>`). It never goes in the app or a package, and the root's install, CI and a deploy never install
  it. `bun run deps:update` leaves both files alone, and ending the experiment removes the library unless another
  experiment names it too.
- **Never a library the root already has.** `effect`, `@effect/*`, React and every package of the repository come
  from the root's install, as they are: `scratch:check` refuses one in the scratchpad's `package.json`, since a second
  copy of `effect` beside the packages' breaks them. So an experiment cannot try another version of a shared library.
- **Graduate or delete.** Graduating does not move code: move it into a package first, make `bun run check` pass
  there, then graduate, in the same change.
- **A warning, not a failure:** `scratch:list` names an experiment older than 30 days or larger than 200 files.
- **State stays out of git and off the app's port.** A screen's dev server keeps its cache in its experiment's own
  `.state` folder (ignored) and takes the first free port from 5273, never the app's 5173. A database is the
  experiment's to put under its own `.state` too: no template or helper gives it a path, and nothing stops an
  experiment from using the app's local database.

Trial code written while building something belongs here too, not in a cache folder: it is type-checked, it can
import the packages, and `scratch:list` shows that it is still there.

## What the rest of the repository does with it

- **It is no workspace** (decision "the scratchpad", its install): the root's `bun install`, on CI and in a deploy,
  never installs anything of it, and a new package is importable from it as soon as `bun install` has run at the root.
- **`bun run check` reads it for three things only:** an import of it from anywhere else (`boundaries:check`), a key
  (`keys:check`) and a home path or a private folder (`private-paths:check`). No other check, the formatter included,
  reads it, and an edit inside an experiment changes the cache key of those three tasks only.
- **Its configuration is the CLI's** (`packages/tooling/tool/cli/src/commands/Scratch/Scratch.config.ts`):
  `scratch:new` writes a file that is missing, `scratch:check` names one that differs, and the CLI's slow test of the
  templates builds its scratchpad from those texts, so CI reads nothing of this folder.
- Turbo runs no task in it: it has no `check`, `lint`, `test` or `build` script.
