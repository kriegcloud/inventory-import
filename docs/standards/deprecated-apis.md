---
type: Standard
title: Deprecated APIs
description: No API marked deprecated is used, whether a library's or one of our own packages', and a check that reads every file's types holds it; with what that check cannot see.
tags: [effect, engineering]
status: draft
---

An API its author marked `@deprecated` is not used: an export, a type, one overload of a function, a property, a JSX
prop, in a library or in one of this repository's own packages. Move to what its note names, after reading that
library's source for what the replacement does differently.

## The check

`bun run deprecated:check` (`bun run beep laws deprecated-apis`), part of `bun run check`. It is beep-effect's rule as
it stands there: oxlint's `typescript/no-deprecated`, an error, with every other category off
(`.oxlintrc.deprecated-apis.json`), on the same engine, `tsrs-lint`. It reads every code file git would commit under
`apps` and `packages` and at the root: sources, tests, scripts and configuration files. Built files are git-ignored,
and nothing else is left out.

```
packages/use/src/Use.tsx:3:27  `old` is deprecated. use next
packages/use/src/Use.tsx:6:28  `text` is deprecated. use label
```

A link in a note (`{@link successors}`) is dropped by the engine, so a note can read "Use for outgoing neighbors": the
library's source has the name.

It also fails when it cannot be sure:

- **A TypeScript file no tsconfig includes** is read without its package's types, and a deprecated `node:url` function
  in it passes. The root `tsconfig.json` is there for this: nothing compiles it, and it references each package's
  `tsconfig.test.json` and `tsconfig.config.json`. A new package adds its line.
- **A file the profile leaves out**: oxlint read fewer files than git lists.

Its answer is kept by Turborepo until a code file, a `tsconfig*.json`, a `package.json`, the profile, `bun.lock` or an
installed package's version changes, so a new `@deprecated` in a dependency is never hidden by an earlier answer. It
takes about a second and a half when it runs (719 files, 64 threads) and none when nothing changed.

To read one folder: `bunx oxlint --disable-nested-config -c .oxlintrc.deprecated-apis.json packages/client`.

## What it cannot see

Each is held by a test (`packages/tooling/tool/cli/test/DeprecatedApis.test.ts`), so an engine that begins to see one
says so.

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
| A line that turns the rule off, as oxlint allows: none is written here | `// oxlint-disable-next-line` |

It does not read prose: an example in a comment or in `docs/`. A plain `.js` or `.mjs` file that no tsconfig includes
is read without Node's types (`apps/inventory/public/theme-init.js`, which imports nothing, and
`scripts/reachable-sources.mjs`, whose `.d.mts` takes its place in the project).
