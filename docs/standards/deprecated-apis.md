---
type: Standard
title: Deprecated APIs
description: No API marked deprecated is used, whether a library's or one of our own packages', and a check that reads every file's types holds it; with what that check cannot see.
tags: [effect, engineering]
status: draft
---

An API its author marked `@deprecated` is not used: an export, a type, a deprecated overload of a function, a property,
a JSX prop, in a library or in one of this repository's own packages. Move to what its note names, after reading that
library's source for what the replacement does differently.

Overloads are told apart only where the function is called. A function with one deprecated overload that is handed on
uncalled (`words.map(ask)`) is refused whichever overload fits: call it in a function of your own
(`words.map((word) => ask(word))`).

## The check

`bun run deprecated:check` (`bun run beep laws deprecated-apis`), part of `bun run check`. It is beep-effect's rule as
it stands there: oxlint's `typescript/no-deprecated`, an error, with every other category off
(`.oxlintrc.deprecated-apis.json`), on the same engine, `tsrs-lint`. It reads every code file git would commit,
wherever it is: sources, tests, scripts and configuration files, a file in a new folder too. Built files are
git-ignored.

Two folders are left out, by name in the law (`leftOut`). `scratchpad/` is where an idea is tried under the
type-checker only: this law, like the others on how code is written, applies to an experiment when its code
graduates into a package ([the scratchpad](../scratchpad.md)). And `.agents/`, the 18 code files of the agent skills, copied as
they were published and run by no part of the app or its checks. Sixteen are other people's; two (the ontology
auditor's script and its test) come from Benjamin's own beep-effect. One of them
(`design-taste-frontend/scripts/lib/probe.mjs`) reads the deprecated CSS properties `clip` and `webkitBackgroundClip`
on purpose, to report a page that uses them: 5 findings if the folder were read. Benjamin chose to leave it out by
name, and the check says so each time it passes.

```
packages/use/src/Use.tsx:3:27  `old` is deprecated. use next
packages/use/src/Use.tsx:6:28  `text` is deprecated. use label
```

A link in a note (`{@link successors}`) is dropped by the engine, so a note can read "Use for outgoing neighbors": the
library's source has the name.

It also fails when the rule could be off, or a file unread:

- **A profile that is anything but the one rule as an error.** An `overrides`, `ignorePatterns` or `extends` entry, a
  second rule, or the rule at `warn` or `off`: nothing is checked, and it says where the profile differs. The profile
  is plain JSON with no comment, so it is read whole.
- **A comment that turns the rule off**, in any file it reads: `oxlint-disable` or `eslint-disable`, for a line, the
  next line or the file, that names `no-deprecated` under any plugin's spelling or names no rule at all. A block
  comment is read to its end, over as many lines as it has, and a reason begins at the first `--`, as oxlint reads
  both. A comment that names only other rules passes. The words are matched as text, so they are refused in a string
  or in a sentence of a comment as well, where oxlint ignores them: write them another way there.
- **A code file no tsconfig includes**, TypeScript or JavaScript: it would be read without its package's types, and a
  deprecated `node:url` function in it passes. A file's project is found from the nearest `tsconfig.json` above it and
  what that references. The root `tsconfig.json` is there for this: nothing compiles it, and it references each
  package's `tsconfig.test.json` and `tsconfig.config.json`. A new package adds its line. In the app, the scripts
  (`scripts/tsconfig.json`) and the one plain script the page loads (`tsconfig.public.json`) have their own.
- **A file oxlint passed over**: it read fewer files than it was handed.

A project only this check reads is type-checked as well, so an import that stops resolving there is an error and not
a type nobody knows, which would hide every deprecated call behind it: `bun run configs:check` for
`tsconfig.config.json` (part of `bun run check`), and the app's own `check` for its scripts and `public/`. Those last
two projects are looser than the rest, by the agent's judgement: no Effect rule applies to them, and in the scripts an
untyped parameter or a package that ships no types is `any` without an error, so a deprecated call behind one is not
seen (`any` is the second row of the table below).

Its answer is kept by Turborepo until a code file or a `tsconfig*.json` anywhere, a workspace's `package.json`, the
profile or `bun.lock` changes, or the manifest of any package installed in the root's `node_modules`. So a new
`@deprecated` in a dependency is not hidden by an earlier answer, and neither is an install that has fallen behind
the lockfile (recorded with `turbo run //#deprecated:check --dry=json`: installed effect's manifest at another
version is a miss, put back a hit). What git ignores and the law does not read is not an input: `.agents`, the
scratchpad, and `.claude`, which in the main checkout holds every other checkout of the repository.
It takes about two seconds when it runs (719 files, 64 threads) and none when nothing changed.

It always reads the whole repository: there is no shorter run for one folder, and running oxlint by hand with the
profile is not this check (no comment, profile or project is looked at).

## What it cannot see

Each is held by a test (`packages/tooling/tool/cli/test/DeprecatedApis.test.ts`), so an engine that begins to see
one says so.

| Form | Example |
| --- | --- |
| A value made from a deprecated one: the line that makes it is refused, the uses of the new name are not | `const bound = old`, then `bound` |
| A value with no type | `untyped.old` where `untyped` is `any`; `Reflect.get(Lib, "old")` |
| A bare parameter default (a default inside a pattern is seen) | `(value = old) => value` |
| A deprecated parameter, at the call | `draw("card")` |
| A key as a type or as one of several | `CardProps["text"]`, `Pick<CardProps, "text">`, `keyof CardProps`, `card[name]` with `name: "text" \| "label"` |
| A property of a type made from the keys | `Record<keyof CardProps, string>` |
| A property handed over inside a whole value (written out in place, it is seen) | `const whole: CardProps = card`, `{ ...card }` |
| A tag on the line of the brace that opens its block: TypeScript does not read it there, so write it on its own line | `interface Inline { /** @deprecated */ readonly text?: string }` |
| Everything passed on at once | `export * from "@x/lib/Lib"` |

It does not read prose: an example in a comment or in `docs/`. And it does not read `.agents/` or `scratchpad/` (above).
