---
type: Standard
title: No try statement
description: Code that can fail is an Effect, or a Result or an Option outside one, never a try statement, in every TypeScript and JavaScript file and in the examples of doc comments; a check that reads every file's syntax tree holds it, with the three paths it does not read and why.
tags: [effect, engineering]
status: draft
---

No `try` statement is written: not with a `catch`, not with a `finally`, not both. My rule, 2026-11-22: "In
beep-effect I've banned try/catch blocks as my preference is either using Effect(s) or effect/Result for code which
can fail with errors. I want this enforced repo wide." A `try` hides what can fail from the type: its `catch` is
handed `unknown`, and what it answers is a value no caller can tell from a success.

It holds in every TypeScript and JavaScript file, sources, tests, scripts and the vendored components alike (each change to a vendored
file is marked "Local change" where it is made), and in the code examples of doc comments: an example is copied, so
one that shows a `try` teaches it.

## What to write instead

Every failure a caller can act on is typed: a `catch` never returns `unknown`.

- **Inside an Effect**, `Effect.try` for code that throws, `Effect.tryPromise` for a promise, each with a `catch`
  that returns a typed error:

  ```ts
  const parsed = Effect.try({ try: () => JSON.parse(text), catch: () => Unreadable.make({ text }) })
  ```

- **Outside an Effect**, `Result.try` when the failure says something, `Option.liftThrowable` (`O.liftThrowable`,
  under its one name) when only "it did not work" matters:

  ```ts
  import * as O from "effect/Option"
  import * as Result from "effect/Result"

  const saved = Result.try({ try: () => localStorage.getItem(key), catch: () => StorageRefused.make({ key }) })
  const parse = O.liftThrowable(JSON.parse)
  ```

- **For a `finally`**, `Effect.ensuring` when something must run however the effect ends, `Effect.acquireUseRelease`
  when what is opened must be closed:

  ```ts
  const report = Effect.acquireUseRelease(open(path), (file) => read(file), (file) => close(file))
  ```

## The check

`bun run try:check` (`bun run beep laws try`), part of `bun run check` and `bun run check:full`. It reads the
syntax tree of every code file git would commit (`.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, `.cjs`),
wherever it is, a file in a new folder too, and refuses each `try` statement at its line, with what to write
instead:

```
packages/client/src/Tab.atoms.ts:17  a try statement with a catch: write Effect.try or Effect.tryPromise with a catch that returns a typed error inside an Effect, Result.try or Option.liftThrowable outside one
apps/inventory/scripts/grid-keys.mjs:211  a try statement with a finally: write Effect.ensuring or Effect.acquireUseRelease for the finally
```

A doc comment's examples are read too: what follows an `@example` tag up to the next block tag (`@param`, `@since`
and the rest of JSDoc's and TSDoc's; a decorator such as `@logged` is code), a fence inside it and the code after
the fence included, and each fenced block of code, fenced by three or more backticks or tildes (no language, or `ts`,
`tsx`, `js` and their kin, with any attribute after it, `ts:line-numbers` or `ts title="x"`). Each is parsed as a
module of its own; one that is not a module (a fragment with `...` in it) is scanned with its strings, regular
expressions and comments skipped. `Effect.try` in an example passes.

What passes: `Effect.try`, `Result.try`, `Option.liftThrowable`, and the word where it is no statement: a member's
name, a key (`{ try: … }`), a string, a comment, a function named `tryThis`.

Nothing turns it off. It reads no configuration, no ledger and no comment that excepts a file or a line, and it
refuses a comment that would turn a linter's rule against `try` off: `oxlint-disable` or `eslint-disable`, for a
line, the next line or the file, that names `no-restricted-syntax`, a rule named `no-try…`, or no rule at all, as
the [deprecated-API check](deprecated-apis.md) refuses one for its rule.

A file larger than a law reads, nested deeper than the parser survives (brackets, chained operators, or statements
nested without braces, `if (a)` on each line), or that the parser reads with errors is refused as a whole, once, at
the line being read, in words that say which, and an example nested too deep is refused the same way, at its line.
One kind of file still kills the check, which then fails without words: thousands of brackets behind a `/` that the
depth count reads as a regular expression where the parser reads a division, or the other way round (after a member
named `of` or `in`, or after a block's `}`). The same is true of `tags:check` and `refs:check`.

What it misses in a doc comment's example, each of them only in an example that is not a module by itself (it has
`...` in it) or is not fenced as code:

- a `try` whose `{` comes after a comment, one inside a template's `${…}`, and one on a line after a `/` that follows
  a member named `of` or `in`;
- a fence whose language is none of the listed ones (`ts-node`), and a block set off by four spaces with no fence.

Its answer is kept by Turborepo until one of these changes: a code file it reads with one of the eight endings
above (in `.claude/` and `.codex/` too), `.gitignore`, `bun.lock` (which holds the parser's version) or the law's
own source. A tracked code file under a `node_modules` or `.session` folder is read by the law, and a change to it
alone does not make Turborepo ask again.

## What it does not read

Three paths, each by name in the law (`tryLeftOut`) and in the line it prints each time it runs:

- **`.agents/`**, the agent skills, copied as they were published and run by no part of the app or its checks, as
  for the deprecated-API check.
- **`scratchpad/`**, where an idea is tried under the type-checker only: this rule, like the others on how code is
  written, applies to an experiment when its code graduates into a package ([the scratchpad](../scratchpad.md)).
- **`apps/inventory/public/theme-init.js`**, the one file allowed a `try`: it "runs before the app loads and cannot
  import Effect without loading the library before first paint" (explorations/ideal-architecture/DECISIONS.md,
  "2026-11-22 — no `try` statement, repository wide"). A file beside it in `public/` is read.

It does not read prose outside a doc comment: an example in `docs/` or in a `//` comment. And it reads no Python:
the two Python scripts the checks run (`packages/catalog/model/mutants/run.py`, `vendor/alchemy/repin.py`) hold
`try` statements, that language's own way to handle an error.
