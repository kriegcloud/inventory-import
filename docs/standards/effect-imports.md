---
type: Standard
title: Effect imports
description: Every Effect module is imported whole from its own path under one fixed name, never through the "effect" barrel or a folder of modules, and a check holds it.
tags: [effect, imports, engineering]
status: draft
---

One module, one path, one name. A reader who sees `O.map` or `HttpClient.execute` anywhere in the repository knows
which module it is without scrolling to the imports, and a search for `effect/Option` finds every file that uses it.

These are beep-effect's rules, taken as written: `standards/effect-laws-v1.md` laws 1 and 2,
`standards/effect-first-development.md` section EF-4, `.patterns/effect-module-paths.md`, and law 2 of its
`effect-first-development` skill. Where its code and its rules disagree, the rule is followed; the disagreements are
listed at the end. Every path below exists in the installed `effect` 4.1.4, and the check reads the installed
package, never a list.

## EI-1. A module comes from its own path, whole

```ts
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as HttpClient from "effect/http/HttpClient"
import * as SqlClient from "effect/sql/SqlClient"
import * as SecureRandom from "effect/crypto/SecureRandom"
import * as D1Client from "@effect/sql-d1/D1Client"
```

Never the root barrel, and never a folder of modules (`effect/ai`, `effect/cli`, `effect/crypto`, `effect/devtools`,
`effect/encoding`, `effect/http`, `effect/http-api`, `effect/observability`, `effect/reactivity`, `effect/rpc`,
`effect/schema`, `effect/sql`, `effect/testing` and the rest). The same holds for a re-export, for `import(...)`, and
for an example in a comment or a document.

```ts
// Wrong: the root barrel, a folder of modules, a package root.
import { Effect, Option, Array as Arr } from "effect"
import { HttpClient, HttpClientRequest } from "effect/http"
import { SqlClient } from "effect/sql"
import { D1Client } from "@effect/sql-d1"
```

## EI-2. A module has one name

| Module | Import line | Name |
| --- | --- | --- |
| `effect/Array` | `import * as A from "effect/Array"` | `A` |
| `effect/Option` | `import * as O from "effect/Option"` | `O` |
| `effect/Predicate` | `import * as P from "effect/Predicate"` | `P` |
| `effect/Record` | `import * as R from "effect/Record"` | `R` |
| `effect/Schema` | `import * as S from "effect/Schema"` | `S` |
| `effect/String` | `import * as Str from "effect/String"` | `Str` |
| `effect/Equal` | `import * as Eq from "effect/Equal"` | `Eq` |
| `effect/Boolean` | `import * as Bool from "effect/Boolean"` | `Bool` |
| `effect/Function`, whole | `import * as F from "effect/Function"` | `F` |
| `effect/BigInt` | `import * as BI from "effect/BigInt"` | `BI` |
| `effect/RegExp` | `import * as Regex from "effect/RegExp"` | `Regex` |
| `effect/Number` | `import * as Num from "effect/Number"` | `Num` (not decided: `N` also passes) |
| every other module | `import * as Effect from "effect/Effect"`, `import * as DateTime from "effect/DateTime"`, `import * as HashMap from "effect/HashMap"`, `import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"`, `import * as TestClock from "effect/testing/TestClock"` | the last part of its path |

The first five are law; `Str`, `Eq` and `Bool` are EF-4's; `F` is the name beep-effect's standard writes in its own
examples; `BI` and `Regex` are the only names its code uses for modules that would otherwise hide a global.

The only time a module takes another name is when its own is already taken in that file by something else, as in the
CSV reader's test, where `Csv` is the package under test:

```ts
import { Csv } from "@beep/csv/Csv"
import * as EffectCsv from "effect/encoding/Csv"
```

```ts
// Wrong: a second name for a module that has one.
import * as Arr from "effect/Array"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Equal from "effect/Equal"
```

## EI-3. Only functions are picked by name

`pipe`, `flow`, `identity`, `dual`, `constant` and the other flat functions come by name from `effect/Function`.
Nothing else is picked out of an Effect module by name: write `O.some`, not `some`.

```ts
import { dual, pipe } from "effect/Function"
```

```ts
// Wrong
import { some, none } from "effect/Option"
import { TaggedError } from "effect/Schema"
import { pipe } from "effect"
```

The test runner is the one package whose root is read by name, as beep-effect does:

```ts
import { describe, expect, it, layer } from "@effect/vitest"
```

## EI-4. A module used only in types is a type import

```ts
import type * as Effect from "effect/Effect"
import type * as HttpApiClient from "effect/http-api/HttpApiClient"
```

A file that needs the module as a value as well imports it once, as a value. A single type may be picked by name from
its module (`import type { PlatformError } from "effect/PlatformError"`); beep-effect does both.

## EI-5. The kit

A kit module is imported by its own path, by name: `import { LiteralKit } from "@beep/schema/LiteralKit"`,
`import { Csv } from "@beep/csv/Csv"`, `import { $CatalogModelId } from "@beep/identity/packages"`. The names in EI-2
always mean the Effect module: a kit helper never takes `A`, `O`, `R`, `P`, `S` or `Str` in this repository's own
code. Not checked.

## The check

`bun run imports:check` (`scripts/check-effect-imports.mjs`), part of `bun run check`. It parses every `.ts`, `.tsx`
and `.mjs` file under `apps`, `packages` and `scripts`, reads the examples in their comments, and reads the import
lines in `CLAUDE.md`, `AGENTS.md`, `README.md`, `DECISIONS.md`, `docs/` and `.claude/agents/` (this page excepted:
it shows wrong imports on purpose). The vendored kit packages, each with a `vendor.json`, are skipped: they are not
this repository's to change.

Each failure is one sentence that ends with the line to write:

```
src/Ids.ts:3  root-barrel: Option from "effect". Write: import * as O from "effect/Option"
src/Http.ts:1  nested-barrel: HttpClient from "effect/http". Write: import * as HttpClient from "effect/http/HttpClient"
src/Rows.ts:2  alias: "effect/Array" as Arr. Write: import * as A from "effect/Array"
src/Rows.ts:4  named-import: some from "effect/Option". Write: import * as O from "effect/Option" and O.some
src/Rows.ts:5  unknown-path: "effect/Strings" is not a path of the installed effect
```

`bun run imports:fix` (`--write`) repairs code: it splits a barrel import into its modules, gives each namespace its
name, and renames the identifiers that follow from a changed name, in code and in the file's comments. It leaves what
it cannot be sure of (a name declared again inside the file, a value picked by name) and says so. Documents are
checked, never rewritten. Run `bun run format -- <files>` after it.

beep-effect's own check is `beep laws effect-imports` (`packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts`),
a ts-morph command inside its CLI that cannot be brought over on its own. This script is the same law, and stricter
in two places: beep-effect's command checks paths only, and this one also checks the name (EI-2) and the pick by name
(EI-3).

## Where beep-effect's code and its rules disagree

Measured over its tracked `apps`, `packages` and `infra` source; counts are import lines.

| Subject | Its rule | Its code | Here |
| --- | --- | --- | --- |
| The root barrel | never | 0 imports | never |
| `effect/Equal` | `Eq` (EF-4) | `Equal` 156, `Eq` 103 | `Eq`: the rule wins |
| `effect/Array`, `Option`, `Predicate`, `Record`, `Schema` | `A`, `O`, `P`, `R`, `S` only | a few of `Arr`, `Option`, `Predicate`, `Rec`, `Schema` (about 1% or less of each) | the rule |
| A value picked by name from a module other than `effect/Function` | laws 1 and 2 read as "whole, by its name"; its command lets it pass | a few dozen (`TaggedError`, `fromUndefinedOr`) against tens of thousands of namespace imports | refused |
| `effect/Number` | none | `Num` 143, `N` 110 | not decided; either passes |
| `@effect/platform-node`, `@effect/platform-bun` | none | by name from the root and whole from the module's path, both common | whole from the module's path; neither package is used by this repository's own code yet |
| Order of imports | Biome sorts: value imports, then type imports, each by path | as sorted | not sorted by a tool here; a new line goes where its path sorts among its neighbours |
