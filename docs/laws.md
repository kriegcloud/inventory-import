---
type: Standard
title: "What the type-check and the laws enforce"
description: "The one compiler profile, its two recorded exceptions, and what fails `bun run check`: absence and defaults, optional properties, indexing, assertions, typed failures, Workers, numbers, Effect 4 only and Effect's collections."
---

# What the type-check and the laws enforce

Moved here from `CLAUDE.md` word for word on 2026-11-26 (goals/focus-and-friction, step 4); `CLAUDE.md` keeps a line that links each section.

Each law's command and what it refuses are in [Commands](commands.md), the row for `bun run check`.

### What the type-check enforces

One profile for the whole repository: the root `tsconfig.base.json`, beep-effect's compiler flags and Effect
language-service severities copied verbatim (the source commit is in its header comment). Every Effect diagnostic is
an error and suggestions fail the exit code too. Everything new starts on it with no exception. Two recorded
exceptions exist, and nothing else may:

- **Stage C, own code with screens** (the app's `src/web`; `@inventory/ui`'s own pieces; `@inventory/review`, its
  gallery fixtures included): `preferEffectArray`, `preferEffectString`, `preferEffectRecord` and
  `missingPipeableSignature` are off, in each package's `tsconfig.base.json`. Each package counts them against the
  ceiling in its `strict-ceiling.json` (`bun run beep quality strict`, part of its `check`), which fails when the count
  is above it, and when it is below it until the ceiling is lowered; `bun run beep quality ceilings` keeps the sum at
  most 678. The numbers only fall. Write new web code the Effect way anyway.
- **Stage D, the vendored components and hooks** (`packages/ui/src/components`, `packages/ui/src/hooks`): every rule
  off, permanently.

The same `check` fails if a package's plugin block drifts from the root's outside `overrides`. Server, api, domain and
test code have no exception at all, and neither have the packages under `packages/`: the vendored kit passes the full
profile, its copied tests included, with no override.

**What fails the check.** Write to these from the start:

- **Absence, starting values and clean-ups are a schema's, never the code's** (`docs/standards/schema-first.md`, SF-3
  to SF-5). A value that may be missing is an `Option`, decoded where it enters (`S.OptionFromOptionalKey`,
  `S.OptionFromNullOr`, `S.OptionFromNullishOr`); a starting value is on the field (`S.withConstructorDefault`,
  `S.withDecodingDefaultTypeKey`); a trim or a change of case is a transformation (`S.decodeTo` with
  `SchemaTransformation` or `SchemaGetter`). A handler gets the type it works with from one decode at its boundary
  and trusts it after that line. So our own code writes no `??`, no `||` before a value, no `getOrElse`, no comparison with `null` or `undefined`, no
  `O.getOrUndefined` or `O.getOrNull`, no `.trim()`, `Str.trim`, `toLowerCase` or `toUpperCase` outside a schema, and
  in a `.ts` file no default on a parameter or a destructured name (`(n = 0) =>`). Two things stay on purpose
  (Benjamin, 2026-11-23). A React component's optional prop stays `?:` and takes its default in the destructuring
  (`{ size = "sm" }`), never with `??` in the body. A strict `=== undefined` or `!== undefined`
  comparison on that component's own props in `.tsx` may distinguish omission from explicit null; `Option` is for data that came through a schema. And a cell of a
  file the person reviews keeps its reader: its trim or change of case is a proposal shown as before and after, so
  code that reads a cell lives in a file the law names (`exemptions` in `Laws/Defaults.rules.ts`, each with its
  kinds and its reason) and nowhere else. Adding a file to that list is Benjamin's decision.
  `bun run check` counts them in every src and test folder against `defaults-baseline.json` (`defaults:check`): a file
  may hold what the baseline names for it and no more, a file it does not name holds none, and the numbers only fall
  (`bun run beep laws defaults --write` lowers them, never raises): over the whole tree the baseline is compared with
  main's, as the bans' ledgers are, so a count raised or a file added in the same commit is refused. In a Claude Code session the same law reads each
  file as it is edited and names the new line and what to write (`.claude/hooks/defaults.sh`). An old place in a file
  you are changing is not yours to clean unless the task says so; a new one is refused.
- **Optional properties**: never pass `undefined` for an optional property. In our own types there is none but a
  React component's props: the field is an `Option`. Where another library's API has one, spread it from the Option:
  `...O.match(x, { onNone: () => ({}), onSome: (x) => ({ x }) })`.
- **Indexing can miss**: `rows[0]` is `T | undefined`. Take it as an Option: `A.head(rows)`, `A.get(rows, i)`.
- **Conditions are booleans**: `if (name !== "")`, `if (count > 0)`, `if (O.isSome(row))`. Not
  `if (name)` or `if (row)`: a count of 0 is false.
- **Every Effect runs**: an Effect that is built and not yielded, returned or assigned is an error (the work never
  happens). `return yield*` a failure; `yield*`, never a bare `yield`.
- **Every service and error is accounted for**: a missing Layer shows as a type error in `worker.ts`; no `any` or
  `unknown` in an error or requirement channel; no type assertion that hides one.
- **Type assertions**: decode application values with a Schema, narrow with a guard, or use a checked type annotation.
  The only compiler claim written here is inside `unsafeAssert<T>(value, "reason")` from `@beep/unsafe-assert`
  (`packages/foundation/typing/unsafe-assert`), a dependency-free foundation package owned here, outside the hashed
  kit. Use it only for a library typing gap that cannot be expressed by the library's types. It performs no runtime
  check. Each call needs an approved, nonempty string-literal reason in
  `packages/tooling/tool/cli/ledgers/unsafe-asserts.json`, counted by file and exact reason. `assertions:check` refuses
  unlisted calls, stale entries, indirect helper values and counts or reasons added against the branch's base, even when source and ledger
  change together. The first ledger is a proposal for Benjamin's approval; later approvals only decrease. Fewer than
  15 calls are allowed. The old `assertions.json` stays as a migration receipt; an own file removed from the old
  override must hold zero assertions. The vendored kit and registry lists retain their existing accounting.
- **Failures stay typed**: errors a caller can act on are `Schema.TaggedError`s (no class extending `Error`); no
  `try/catch` in a generator, no `async` function, no `new Promise`; `Effect.try` and `Effect.tryPromise` always have
  a `catch` that returns a typed error.
- **Nothing that differs or throws on Workers**: no bare `fetch`, `JSON.parse`/`JSON.stringify`, `process.env`,
  `setTimeout`, and no Node built-in import. Use `Effect.tryPromise` at the edge of a Promise API.
- **Numbers** in Schemas are `Schema.Finite` or `Schema.Int`, never `Schema.Number`. Decode inside an Effect with
  the Effect decoders, not `decodeSync`.
- **Effect 4 only**: an API that Effect 4 removed or renamed is an error.
- **Effect's collections, never `Map` or `Set`**, anywhere in `src` and `test` (oxlint refuses them): `HashMap` and
  `HashSet` for a value handed on (React state included), `MutableHashMap` and `MutableHashSet` for one a function
  fills, or a `Record` or `A.dedupe`. `WeakMap` and `WeakSet` stay where an entry must go with its key. Only
  `packages/ui/src/components` (`@inventory/ui`) (vendored, as published) keeps its own.

**Also enforced, beyond the list above** (the full profile): the Effect modules for strings, arrays and records
(`A`, `Str` and `R`, imported as `docs/standards/effect-imports.md` says: `A.map(xs, f)`, `A.findFirst` (an Option),
`Str.includes("x")(name)`, `R.toEntries(r)`); `concurrency` stated on every `Effect.forEach` and `Effect.all`
(`{ concurrency: 1 }` keeps them sequential); no `yield*` inside a call's arguments (yield, then call); time from
`Clock` or `DateTime`, randomness from `Random`, ids from `effect/crypto/SecureRandom`, logs through `Effect.log`, never
`console`; service keys that follow the package and path (`"@inventory/app/server/Activities"`, as the
`deterministicKeys` rule derives it); a two-argument exported helper is dual (data-first and pipeable, `dual` from
`effect/Function`; see `hasRole`). Schema classes carry a brand and are built with `.make`.

**Not checked by the profile**, and still rules:

- **Look up file content with `R.get(table, key)`** (an Option; `import * as R from "effect/Record"`, so
  TypeScript's `Record<K, V>` stays usable). A plain `table[key]` finds `constructor` and `toString` when a cell
  says so: that is an HTTP 500 the type-check does not see.
