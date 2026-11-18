---
type: Research
title: beep-effect direction
description: Research report on rebuilding inventory-import in beep-effect's model-first package shape: tree, toolchain, Turborepo, packets and the order of moves.
---

# Rebuild inventory-import as model-first's first real instance

inventory-import should become a small bun + Turborepo monorepo with one deployable app (`apps/inventory`, the Worker and the SPA still built by one Vite config), two bounded contexts in beep-effect's model-first package shape (`access` and `catalog`, each split into `-contract`, `-model`, `-host` and `-web`), one language-only kernel, three product-neutral drivers (D1, Better Auth, the AI SDK), two app-owned UI packages, and five `foundation/modeling` packages: `@beep/csv` and `@beep/xlsx`, built on the exemplars' codec pattern, plus a vendored subset of `@beep/identity`, `@beep/schema` and `@beep/utils` that the exemplars cannot work without. The old foundation/drivers grammar supplies everything outside the contexts; the model-first doctrine supplies everything inside them, and the two agree at every edge except a handful of named conflicts (section 1). The hard costs are not where the brief expects them: the compiler flags already match beep-effect (0 plain TypeScript errors under its flags), the Effect diagnostic severities do not (2,167 errors, 744 in the app's own code), and `@beep/xlsx` is mostly new code, because today's reader wraps SheetJS rather than parsing anything itself. Because no model-first slice exists in beep-effect's `packages/` yet, this repository would be the doctrine's first real instance, which is a reason to follow the shape literally and to resist multiplying packages: nine slices times four roles is the wrong reading of "a package per dependency closure".

## Where the brief's premises did not hold

| Premise | What is actually there | Where it is dealt with |
| --- | --- | --- |
| `beep-effect/packages/execution-authority` shows the model-first direction | It is built in the **old** seven-role layout (five packages: `domain`, `use-cases`, `server`, `tables`, `config`; `entities/`/`values/` folders; `.model`/`.ports`/`.repo`/`.layer`/`.table` files). The only model-first artefacts are the documented minimum slice (`beep-effect/standards/architecture/13-onboarding-the-minimum-viable-slice.md`) and the prototype in `beep-effect/scratchpad/model-first-slices` (package scope `@proto/*`, three contexts). **This repository would be the first real model-first instance.** | §1, §4, §9 |
| The four exemplars use the filename-postfix convention | `@beep/toml`, `@beep/jsonl`, `@beep/jsonc` and `@beep/yaml` have **zero** suffixed files (0/15, 0/11, 0/15, 0/49), and all four export `./internal/*` and a `./*` wildcard, while the standard prescribes `*.schema.ts`/`*.codec.ts` anchors for `foundation/modeling` and exact exports for model-first packages. | §2 (one consistent rule), §9 |
| The exemplars may wrap a parser | None does. Engines are written or vendored with attribution; `smol-toml`, `jsonc-parser` and `yaml` are **devDependencies used only as differential test oracles**. | §2, §3 |
| inventory-import's reader can be lifted into `@beep/csv`/`@beep/xlsx` | The reader **wraps papaparse 5.7.1 and the SheetJS CE 0.20.3 mini build**. The hand-written parts are format sniffing, the encoding fallback, cell typing and the layout/notes layer (`src/domain/SheetLayout.ts`). What lifts is knowledge, limits, fixtures and tests, not a parser. | §3 |
| A CSV/XLSX parser must be written from nothing | **Effect 4.1.4 ships `effect/encoding`** with `Csv` (`@stability unstable`), `Zip` and `Xml` (both experimental). Each was confirmed in the installed `node_modules/effect/src/encoding/`. | §3: Csv is the strict-mode oracle, Zip and Xml are reused behind one internal file each |
| `@beep/csv` is a free name in the beep-effect world | `@beep/schema` already owns a CSV concept (`Csv`, `CsvParser`, `CsvFormatter`, `CsvCodecOptions`, `CsvError` under `beep-effect/packages/foundation/modeling/schema/src/Csv/`). The single-owner rule ("Upstream-First Foundation/Modeling") forbids a second owner in one repository. | §3, §9 |
| The exemplars are self-contained | Their only runtime dependencies, `@beep/identity`, `@beep/schema` and `@beep/utils`, are **`"private": true` workspace packages** in beep-effect (checked in each `package.json`). A separate repository cannot install them. | §2, §4, §9 |
| inventory-import needs beep-effect's compiler flags | It already sets every strictness flag beep-effect sets. **The gap is Effect diagnostic severities:** 2,167 errors under beep-effect's profile, 744 in own code and 1,423 in vendored `src/web/components/ui`. | §5 |
| beep-effect's doctrine maps onto this stack | The doctrine binds `@alchemy.run/domain` and hosts on Effect Cluster over Postgres. It never mentions Cloudflare Workers or D1. Every mapping to Workers/D1 here is inference. The Alchemy domain-layer report owns whether `Domain.Model` runs on Workers/D1; the Alchemy infrastructure report owns deployment and `@beep/infra`. | §1, §4, §9 |
| The postfix rules come from the "Context as Topology" X post | The post could not be read (HTTP 402 Payment Required). The in-repository copy of the article (`beep-effect/goals/repo-codegraph-jsdoc/X-ARTICLE.md`) states no suffix list; it points to §6 "Topology Is Compressed Context" of `beep-effect/standards/ARCHITECTURE.md`. **Every postfix rule here rests on that standard.** | §2 |
| `@beep/*` is the natural scope for everything | `@beep/ui` already exists in beep-effect (`foundation/ui-system/ui`), so an app design-system package under `@beep/*` would collide. | §4, §9 |

## 1. Foundation and drivers survive unchanged; the slice shape is replaced

### The old foundation/drivers rules

Source: `beep-effect/standards/ARCHITECTURE.md` (Non-Slice Family Grammar, Family And Kind Dependency Rules, Driver Boundary, Canonical File-Role Anchors) and `beep-effect/packages/foundation/README.md`.

| # | Rule |
| --- | --- |
| F1 | Non-slice code lives in named families, never a `common` bucket: `packages/foundation/<kind>/<name>`, `packages/drivers/<name>`, `packages/tooling/<kind>/<name>`. |
| F2 | Foundation kinds are layered: `primitive` → `primitive`; `modeling` → `primitive`, `modeling`; `capability` → those plus `capability`; `ui-system` is a side branch over `primitive`/`modeling`/`ui-system`, with drivers only through a browser-safe edge. |
| F3 | Foundation holds no product-domain concepts. |
| F4 | `foundation/capability` admits a package only if it has no product semantics, wraps no external engine, is not tooling or UI, and has **at least two named consumers** importing it. "Reusable shape alone is not proof." |
| F5 | Drivers own external engines, SDKs and services: technical errors, test layers, and facades over unsafe third-party shapes. They expose technical capability, never product verbs. |
| F6 | Drivers may import `primitive`, `modeling` and `capability`, and other drivers acyclically; never shared/product code or tooling. |
| F7 | A driver is one `Context.Service` class with its Layer constructors as statics (`layer`, `makeLayer`, `layerTest`), errors in `X.errors.ts`, a ready test layer in `X.test-layer.ts`. Separate `.layer.ts` files are not universal in practice. |
| F8 | Package metadata declares `"beep": { "family", "kind" }`, and path and metadata must agree. |
| F9 | Apps are executable workspaces; runtime wiring is app-local; no God Layer re-exports slice Layers or owns product policy. |

### The model-first rules

Source: `beep-effect/standards/ARCHITECTURE.md` (Model-First Slice Topology, File Grammar, Exact Exports, Legal Imports, Between Contexts, Stored Formats) and chapter 13.

| # | Rule |
| --- | --- |
| M1 | A slice is a bounded context: it owns a language, its data and its invariants. Context-window size is not a boundary test. |
| M2 | A package exists for one dependency closure: `<ctx>-contract`, `<ctx>-model`, `<ctx>-host` always; `<ctx>-web` only when the context has screens. The minimum legal slice is three packages. |
| M3 | `use-cases`, `tables` and `config` dissolve; `client` and `ui` merge into `web`. |
| M4 | Design order: commands with their events and rejections, ids and read contracts, all as Schemas, in the contract; then aggregates, views and ports in the model; then handlers and adapters. "The aggregate does not type-check until it handles every event and rejection its commands declare." |
| M5 | The contract has no Layer and no aggregate; the model has Layers only for its handlers and declares every outside service as a port; the host is the only package that resolves a driver. |
| M6 | Files are `<Module>/<Noun>.<kind>.ts`; folders are Modules; no kind folders, no subdomain folders; one primary export per file; generated files are never edited; `.live.ts` is retired. |
| M7 | Every package's `exports` names each entry exactly; no `./*` wildcard; a root entry is a pure re-export. |
| M8 | Between contexts: never another context's aggregate, private event, view, store, handler or model; only contracts (gateway ports, versioned integration facts). |
| M9 | Stored bytes are never rewritten; formats convert on read, one declared transform per incompatible step, proved by frozen old-format fixtures. |
| M10 | A purity type in `<Context>.ports.ts` fails when a handler needs a service the model never declared. |
| M11 | Every write and reaction is an `@alchemy.run/domain` block; one `Domain.Model` per context by default; Effect Cluster on Postgres is the first host. |
| M12 | The Effect language-service rules run in every check with nothing switched off. |

### Where they conflict, and which wins here

`beep-effect/goals/model-first-standard/SPEC.md` lists "changing the rules for non-slice families" as a non-goal, and `ARCHITECTURE.md` marks the model-first shape as Target Doctrine and the seven-role slice as Transitional Compatibility, "Forbidden In New Work". For a new repository the rulings are therefore simple: **inside a context, model-first wins every row; outside a context, the family rules stand.** The table below lists the conflicts that bite this repository, not the seventeen-row history.

| Conflict | Old rule | Model-first rule | Winner here, and why |
| --- | --- | --- | --- |
| Packages per slice | up to seven roles | three or four | Model-first: it is the doctrine for all new work, and fewer closures means fewer packages. |
| Exports | explicit subpaths canonical, `./*` tolerated "during migration"; the four exemplars export `./*` and `./internal/*` | exact exports, no wildcard | **Exact exports everywhere, foundation included.** A new repository has no migration to tolerate, and one rule for every package is cheaper to check than two. |
| Persistence | `tables` package, `toPgTable(EntityModel)` | tables are projection or inbox stores behind ports in the host | Model-first. D1 tables become host stores behind model-declared ports (inference: beep-effect never discusses D1). |
| Config | `config` package with five subpaths | runtime config belongs to the host or the app | Model-first. `src/server/Settings.ts` splits per driver and per host. |
| Event sourcing | optional per slice | every write is an `@alchemy.run/domain` block | **Neither yet.** Recommend the model-first package shape now with state tables behind ports, and event sourcing only after the Alchemy domain-layer report shows `Domain.Model` on Workers/D1 (decision 1). |
| Actor | `Actor`, `CurrentActor`, `audience` | "retired"; only an `authority` context builds an `Invocation` | **Old rule, as a recorded exception.** The app has no `authority` context, and `CurrentActor` guards every write through `requireRole`. Keep it as kernel middleware (decision 15). |
| Audit writes | not covered | a context owns its data; integration only through facts | **Recorded exception.** Every write path appends `activity` rows in the same atomic D1 batch. Replacing that with projected facts gives up atomicity; keep it (decision 14). |
| Foundation suffix anchors versus exemplars | `*.schema.ts`, `*.codec.ts` anchors | (model-first does not govern foundation) | Suffixes in filenames, concept names in public subpaths (§2). |

The deeper point for Benjamin: the conflicts are all **inside** the slice boundary. The doctrine's edges (drivers as flat technical wrappers that only the host imports, foundation as the dependency floor, contracts and models capped at `primitive` and `modeling`) are the same in both eras. That is why the new repository can take foundation/drivers from the old text and the slice shape from the new text without contradiction.

**Pushback on "nine slices".** The code splits into about nine feature areas (identity, people, activity, items, import, suggestions, table assistant, model allowance, platform). Read through M1, most are Modules, not contexts. The test is invariants:

- The import's confirm and take-back write `item` rows, outcomes and activity in **one atomic D1 batch**, and `src/server/Items.ts` imports `itemColumns`/`ItemRow` from `src/server/Imports.ts`. Items and imports share an invariant, so they are **one context**, `catalog`. Splitting them would force a gateway that leaks SQL statements or gives up atomicity.
- Organizations, members, roles, people, the audit read side and the daily model allowance (40 calls per organization per day) are all answers to "who may do what here": the context `access`.
- Suggestions and the table assistant are Modules of `catalog`; platform code is host and app wiring.

Two contexts give eight packages. Nine slices in the doctrine's shape would give 27 to 36 packages for about 35,000 lines of own code. **Recommendation: two contexts, each in the full doctrine shape** (decision 2). The alternative of keeping contexts as folders inside four role-wide packages saves six packages but breaks M2's one-closure-per-package reading and M8's package-enforced isolation, which is the evidence beep-effect needs from a first instance; it stays the fallback only if Benjamin rejects the two-context cut.

## 2. A new package must pass a fifteen-point anatomy check

### The anatomy, as a checklist

Items 1 to 13 are what all four exemplars share; items 14 and 15 are this repository's resolution of the exemplars' inconsistencies. Each line is checkable by reading the package.

| # | Requirement | Source |
| --- | --- | --- |
| 1 | Lives at `packages/foundation/modeling/<name>` with `"beep": { "family": "foundation", "kind": "modeling" }`, `"private": true`, `"type": "module"`, `"license": "MIT"`, `"sideEffects": []`. | `beep-effect/packages/foundation/modeling/toml/package.json` |
| 2 | Runtime dependencies: `effect` plus `@beep/identity`, `@beep/schema`, `@beep/utils`, nothing else. A third-party parser appears **only** in devDependencies, imported by exactly one oracle test file. | the four `package.json` files; `toml/test/oracle.property.test.ts` ("the ONLY file that may import smol-toml") |
| 3 | An identity composer is registered (`$CsvId`), and every module starts `const $I = $CsvId.create("<Module>")`, annotating schemas with `$I.annoteSchema`/`annoteKey`/`annoteError`. | `beep-effect/packages/foundation/modeling/identity/src/packages.ts` |
| 4 | `src/index.ts` is a documented barrel (`@packageDocumentation`) re-exporting public modules by name, types via `export type`. | `toml/src/index.ts` |
| 5 | One facade class of statics, named after the format, with `parseResult`/`parse`, `stringifyResult`/`stringify`, `fromString(options?)`, a pre-bound `<Fmt>FromString`, `schema` and `bind`. | `toml/src/Toml.ts` |
| 6 | Every fallible operation has a synchronous `*Result` twin (never `*Sync`); the Effect form is `Effect.fn("<Fmt>.op")` over `Effect.fromResult(opResult(...))`. Pure synchronous operations carry no Effect and no span. | `jsonc/KNOWLEDGE.md`, `toml/KNOWLEDGE.md` |
| 7 | The codec is `S.String.pipe(S.decodeTo(S.Unknown /* or a model */, SchemaTransformation.transformEffect({ decode, encode })))`, domain failures mapped to `new SchemaIssue.InvalidValue({ message }, input)`. With options, `schema` is `makeTextDecodeTo(fromString)` from `@beep/utils/Schema`. | `toml/src/Toml.ts:513-626`, `beep-effect/packages/foundation/modeling/utils/src/Schema.ts:107-163` |
| 8 | Errors are `S.TaggedError` classes with a branded `Self`, structured fields and a `message` getter (never a `reason: string`). Parse errors aggregate `diagnostics`; a diagnostic is an `S.Opaque` of `{ code, message, offset, length, line, character }`, 0-based, with codes as `LiteralKit` unions. | `toml/src/TomlDiagnostic.ts`, `jsonc/KNOWLEDGE.md` |
| 9 | Options are `S.Opaque` structs of `S.optionalKey` fields; defaults applied in code. | `TomlStringifyOptions` in `Toml.ts` |
| 10 | The engine lives in `src/internal/`, returns or throws raw records, and never imports the facade; only the facade materialises typed errors (the "cycle firewall", enforced by `noImportCycles` at error level). Caps live in `internal/limits.ts` and fail into the typed channel, never as a defect or stack overflow. | `toml/src/Toml.ts:1-17`, `jsonc/KNOWLEDGE.md` |
| 11 | Pure tier: no `node:` imports, no platform packages, Effect collections only, per-module `effect/<Module>` imports, never the `effect` root. | `jsonc/KNOWLEDGE.md`, `toml/README.md` (Deviations) |
| 12 | Every export carries JSDoc: first sentence, a compiled example importing the public subpath, `@category`. Docgen excludes `src/internal/**`. | `toml/docgen.json` |
| 13 | Tests use `@effect/vitest`: per-module `X.test.ts`, `X.property.test.ts` (a `roundTrips` law over every codec using `Arbitrary.schema`, `S.toEquivalence` and a fixed run count), `X.coverage.test.ts`; one oracle file; one hostile-input file; a vendored conformance corpus where one exists; tests import public subpaths. | `toml/test/` |
| 14 | **Exact exports, no `./internal/*`.** The exemplars export it; this repository does not (§1). Tests of internal engine modules import them by relative path, the one permitted exception to "tests import public subpaths". | this report's ruling; `ARCHITECTURE.md` (Exact Exports; "parser internals under `src/internal/` are not public package subpaths" for `@beep/schema`) |
| 15 | **Role suffixes in filenames, concept names in subpaths** (below). | this report's ruling |

Two things the exemplars rely on do not exist in the new repository. beep-effect's scaffolder (`beep create-package`, which also registers identity and workspaces) and its gate (`beep quality package-verify`) are beep-effect tooling. Until something replaces them, items 1 to 13 are checked by copying a package directory and by `turbo run check lint test`.

### The postfix rules, stated as rules

From `ARCHITECTURE.md` §6 "Topology Is Compressed Context", "Role Suffixes", "File Grammar" and "Canonical File-Role Anchors", and `beep-effect/standards/architecture/00-philosophy.md` ("The role suffix is a precondition check that runs at file-name time, not test time"):

1. A filename is `<Noun>.<role>.ts` (`.tsx` for React). `<Noun>` is PascalCase; `<role>` is lowercase, hyphenated when multi-word (`.test-layer.ts`).
2. `<role>` comes from the vocabulary of the package's family or kind. A role is used only when it exists; the full vocabulary is never required.
3. Package-level composers are bare PascalCase with no role (`Adapters.ts`, `Host.ts`, `Config.ts`).
4. One primary export per file, named after the noun (model-first).
5. Role files are source topology; only an exact export entry is public.
6. No kind or subdomain folders in model-first packages; folders are Modules.
7. `.live.ts` is retired.

### One consistent choice for this repository

The exemplars are flat and suffix-free (`TomlDiagnostic.ts`); the anchors say `*.schema.ts`/`*.codec.ts`. **Recommendation: every file outside `internal/` and `index.ts` carries a role, and every public subpath names the concept without it.**

```
packages/foundation/modeling/csv/src/
  index.ts                     pure re-export
  Csv.codec.ts                 facade: parse/stringify, codecs, channels      → "./Csv"
  CsvTable.schema.ts           canonical decoded model                         → "./CsvTable"
  CsvOptions.schema.ts         dialect, read/write options, limits            → "./CsvOptions"
  CsvDiagnostic.schema.ts      diagnostic and code unions                     → "./CsvDiagnostic"
  CsvError.errors.ts           CsvParseError, CsvStringifyError               → "./CsvError"
  internal/machine.ts …        engine parts, named by function, never exported
```

The public import stays `@beep/csv/Csv`, identical in shape to `@beep/toml/Toml`, so a consumer never sees the role; a reader of the tree sees it at file-name time, which is the whole argument of "topology is compressed context". `@beep/schema` already works this way (role files private, concept subpaths public). Roles per family in this repository:

| Family | Roles |
| --- | --- |
| `foundation/modeling` | `.codec.ts`, `.schema.ts`, `.errors.ts` |
| `drivers` | `.service.ts` (class with Layer statics), `.errors.ts`, `.config.ts`, `.test-layer.ts` |
| kernel | `.id.ts`, `.context.ts`, `.middleware.ts` |
| `<ctx>-contract` | `.id.ts`, `.command.ts`, `.event.ts`, `.rejection.ts`, `.read.ts`, `.gateway.ts`, `.contract.ts` |
| `<ctx>-model` | `.aggregate.ts` (only once decision 1 adopts it), `.rules.ts`, `.view.ts`, `.query.ts`, `.handler.ts`, `.store.ts`, `.external.ts`, `<Context>.ports.ts` |
| `<ctx>-host` | `.adapter.ts`, `.http.ts`, `.route.ts`, `Adapters.ts`, `Host.ts`, `Config.ts` |
| `<ctx>-web` | `.screen.tsx`, `.machine.ts`, `.controller.ts`, `.runtime.ts` |

## 3. `@beep/csv` reads leniently and writes canonically; `@beep/xlsx` is mostly new code

### What exists to build on

```
today                                            proposed
─────                                            ────────
File ─► read.ts sniff (zip/OLE/PDF/PNG/NUL)      File ─► app adapter: format triage + wording (stays)
          │                                                │
          ├─ csv.ts  ─► papaparse 5.7.1                    ├─ @beep/csv   own state machine
          │            + utf-8→1252 fallback               │              (effect/encoding/Csv = oracle)
          └─ xlsx.ts ─► SheetJS mini 0.20.3                └─ @beep/xlsx  own OOXML reader over
                       + SSF dates/formats                                effect/encoding Zip + Xml
          │                                                │
          ▼                                                ▼
     SheetGrid ─► SheetLayout (header search, 24 Note kinds) ─► SpreadsheetTable ─► stageTable ─► chunks
                  └──────────────────────── stays in the app (catalog-web / catalog-model) ───────────┘
```

| Effect module (4.1.4) | Stability | What it does | Relation |
| --- | --- | --- | --- |
| `effect/encoding/Csv` | `unstable` | RFC 4180 streaming codec; LF/CRLF/CR; strips a leading BOM; cells are strings; `CsvError` is a `Data.TaggedError` of kind `Syntax`/`RecordSize`/`Header`; stray quotes and text after a closing quote are `Syntax` errors; wrong width fails with headers; encoder quotes delimiter, `"`, CR, LF and a leading BOM, no formula guard. | **Oracle only.** It is strict by design, so it refuses exactly the files an import must read (stray quotes, ragged rows). Its errors are not Schema errors. Wrapping it would mean two parsers for two modes and break the chunk-invariance law. `@beep/csv`'s strict mode must agree with it on generated RFC text. |
| `effect/encoding/Zip` | experimental | Streams entries in archive order from local headers; pure-JS inflater (internal); writes via `CompressionStream("deflate-raw")`; ZIP64; never reads the central directory. | **Reuse behind `internal/inflate.ts`** for inflating one entry, and `Zip.encode`/`Zip.file` for writing. Not enough alone: sheets may precede `sharedStrings.xml`, so `@beep/xlsx` adds its own central-directory index. |
| `effect/encoding/Xml` | experimental | Well-formed XML 1.0 events; no external entities, no DOCTYPE expansion (no XXE); `elements(path)` collects repeated elements one at a time; tokens split anywhere; `positions` since 4.1.3; `namespaces: "strict"` only since 4.1.5, **not on the pinned 4.1.4**. | **Reuse behind `internal/ooxml.ts`**, matching on local names (strip `prefix:`). |

The same `effect/encoding` folder also ships `Toml`, `Yaml`, `Jsonc` and `Ndjson`, which overlap with beep-effect's exemplars; whether those exemplars should defer to upstream is outside this report and belongs to the Effect v4 source-modules report.

**Why a lenient parser is still needed.** The app's own sample (`public/samples/items_messy.csv`) and fixtures carry quoted headers with trailing spaces, doubled quotes, line breaks inside quotes and mixed CRLF/LF physical lines; the reader today turns papaparse's `InvalidQuotes` into a `strayQuote` warning and reads on. A person importing a file must be told what is odd and still get their rows. Effect's `Csv` would refuse the file.

### `@beep/csv`: schemas and codec types first

Design sketch (not compiled; every Schema name below exists as an export of the installed `effect` 4.1.4, signatures beyond the exemplars' usage are Unverified where marked):

```ts
// design sketch — CsvTable.schema.ts: the canonical decoded side
export class CsvTable extends S.Opaque<CsvTable, { readonly brand: unique symbol }>()(
  S.Struct({
    header: S.Option(S.Array(S.String)),   // None when header: "none"   (Unverified: S.Option's encoded form)
    records: S.Array(S.Array(S.String)),   // cells only, never coerced
  }),
) {}

// design sketch — streaming element, modelled on jsonl's LineSlice
export class CsvRecordSlice extends S.Opaque<CsvRecordSlice, { readonly brand: unique symbol }>()(
  S.Struct({
    cells: S.Array(S.String),
    record: S.Int,                          // 1-based record number
    line: S.Int,                            // 1-based physical line where the record starts
    offset: S.Int,                          // 0-based; UTF-16 units for text input
    terminator: CsvTerminator,              // LiteralKit(["\n", "\r\n", "\r", ""]); "" = last record, no break
  }),
) {}
```

**Encoded sides.** `string` for `fromString`; `Uint8Array` (`S.Uint8Array`) for `fromBytes`, which composes encoding detection with the string codec:

```
Uint8Array ──detect──► string ──machine──► CsvTable ──S.decodeTo(rowSchema)──► ReadonlyArray<Row>
   │  BOM EF BB BF → utf-8 (BOM recorded)
   │  BOM FF FE / FE FF → utf-16le / utf-16be      (fixes today's "a binary file" refusal)
   │  valid UTF-8 → utf-8
   └  otherwise → windows-1252 + warning naming the first offending offset
```

**Options** (`CsvOptions.schema.ts`, `S.Opaque` structs following `TomlStringifyOptions`):

| Option | Values | Default for reading files |
| --- | --- | --- |
| `dialect` | `{ delimiter, quote, terminator }` or `"detect"` | `"detect"` over `, ; \t \|` by field-count consistency |
| `encoding` (bytes only) | `utf-8`, `utf-16le`, `utf-16be`, `windows-1252`, `detect` | `detect` |
| `header` | `none`, `first` | `none` (header *search* under title rows stays in the app) |
| `quotes` | `strict`, `lenient` | `lenient` |
| `ragged` | `keep`, `pad`, `fail` | `keep`, always reported |
| `blankLines` | `keep`, `skip` | `keep` |
| `trim` | `none`, `unquoted`, `all` | `none` |
| `excelSepHint` | boolean | `false` |
| `limits` | `maxBytes`, `maxRecords`, `maxFieldsPerRecord`, `maxFieldLength`, `maxRecordLength` | set from the app's measured limits |
| write: `quoteStyle` | `minimal`, `always`, `nonNumeric` | `minimal` |
| write: `bom`, `finalTerminator` | boolean | `false`, `true` |
| write: `formulaGuard` | `none`, `apostrophe`, `tab` | `none` in the package; the app passes `apostrophe` |

The delimiter check uses `S.check` (exported in 4.1.4; Unverified: the predicate spelling for "one character, not quote/CR/LF"); fall back to `LiteralKit([",", ";", "\t", "|"])` until checked.

**Error model**, split exactly as toml and jsonl split it:

| Type | Shape | Raised by |
| --- | --- | --- |
| `CsvDiagnostic` (`S.Opaque`) | `{ code, message, offset, length, line, character, record, field }`, 0-based | engine raw carriers, materialised by the facade |
| `CsvErrorCode` (`LiteralKit`) | `UnterminatedQuote`, `RaggedRecord`, `DuplicateHeader`, `EmptyHeader`, `RecordTooLong`, `FieldTooLong`, `TooManyRecords`, `TooManyFields`, `InvalidUtf8`, `BinaryContent`, `UnmappableCharacter`, `AmbiguousDelimiter` | fatal |
| `CsvWarningCode` (`LiteralKit`) | `StrayQuote`, `TextAfterClosingQuote`, `DelimiterDetected`, `NotUtf8`, `MixedTerminators` | never failures; returned as data beside the table |
| `CsvParseError` (`S.TaggedError`) | `{ diagnostics }` | `parse`, `parseResult`, channels |
| `CsvStringifyError` (`S.TaggedError`) | `{ diagnostic }` | `stringify` (for example an unmappable character in windows-1252) |
| inside the Schema codec | `SchemaIssue.InvalidValue({ message }, input)` → `S.SchemaError` | `fromString`, `schema`, `bind` |

Warnings are data, not errors, so the app maps them straight to its Notes (`strayQuote`, `notUtf8`, `delimiter`).

**What round-trips, and what cannot.**

| Law | Holds on |
| --- | --- |
| decode ∘ encode = id | every `CsvTable` consistent with the header and ragged policy; a lone empty cell is written as `""` so it does not read back as a blank line; a cell starting with a BOM is quoted |
| encode ∘ decode = id | **canonical text only**: minimal quoting, one terminator, final terminator per option, no BOM unless asked, strict quotes. Any other text is normalised. |
| chunk invariance | for every split of the input (including between `\r` and `\n`, inside a doubled quote, inside a multi-byte UTF-8 sequence on the bytes path), streamed records equal one-shot records. This turns today's `test/web/readInPieces.test.ts` (seven chunk sizes) into a property. |
| bytes | the laws lift to `Uint8Array` only with a fixed encoding. Under `detect`, decode is many-to-one (corrupt UTF-8 read as 1252 re-encodes as 1252). |

Byte-for-byte losslessness for arbitrary messy text needs a `CsvDocument` that keeps each field's quoting and raw spelling, each record's terminator, offsets and the BOM. **Pushback: do not ship it in v1.** The exemplars keep losslessness in a separate `<Fmt>Document` because their users edit config files in place; nobody edits a CSV in place here. The app reads files and writes one canonical file (the left-out rows). Recommendation: the machine's raw record already carries `quoted` and `terminator` (it needs both for diagnostics), so `CsvDocument` can be added later without changing the engine (decision 7).

**Streaming for large files.** One push-based state machine (`internal/machine.ts`: states field-start, unquoted, quoted, quote-in-quoted, plus a pending-CR flag) holds at most one partial record, so memory is bounded by `maxRecordLength`, not file size. The one-shot `parseResult` is `push(text)` then `end()`. The streaming decoder is `Channel.mapAccum(state, push, { onHalt: end })`; the bytes decoder puts `Channel.decodeText` in front. `Channel.decodeText` with `fatal: true` turns invalid input into a **defect**, so the bytes path must use a non-fatal decoder plus its own UTF-8 validation to keep `InvalidUtf8 { byteOffset }` typed. Encoding detection in a stream decides from a first window of bytes; invalid UTF-8 found after the window fails rather than mixing encodings. (`Channel.mapAccum` with `onHalt`, `Channel.decodeText`, `Channel.encodeText`, `Stream.pipeThroughChannel` and `Stream.fromReadableStream` are all exported by the installed 4.1.4.)

**Messy real files.**

| Case | Handling |
| --- | --- |
| BOM | stripped, recorded as data |
| CR, LF, CRLF, mixed | each record keeps its own terminator, so a mixed file reads correctly. Today's reader guesses one newline from the first 1 MiB; the effect on a mixed file is untested (Unverified against papaparse) |
| quoted newlines, quotes, delimiters | core state machine; row numbering stays "as Excel shows it" (a quoted break stays in its record) |
| unterminated quote | fatal `UnterminatedQuote` naming the record and line where the quote opened |
| stray quote, text after a closing quote | lenient: kept as text plus a warning; strict: fails, agreeing with Effect's `Csv` |
| ragged rows | per `ragged`, always reported |
| blank lines | per `blankLines`; a blank record is distinct from a lone `""` cell |
| trailing delimiter | a trailing empty field, never dropped |
| final line break | never creates a record (today's behaviour) |
| UTF-16 | detected by BOM |
| Windows-1252 | fallback with a warning; writing 1252 needs a hand table because `TextEncoder` is UTF-8 only |
| `sep=;` first line | honoured only with `excelSepHint` |
| formula injection | a writer option; the reader never alters text |

**Public API.**

| Export | Shape (design sketch) |
| --- | --- |
| `Csv.parseResult` / `Csv.parse` | `(text, options?) => Result<CsvTable, CsvParseError>` / `Effect.fn("Csv.parse")` |
| `Csv.parseBytesResult` / `Csv.parseBytes` | as above over `Uint8Array`, returning the detected encoding with the table |
| `Csv.stringifyResult` / `Csv.stringify` | `(table, options?) => Result<string, CsvStringifyError>` |
| `Csv.fromString` / `Csv.TableFromString` | `S.Codec<CsvTable, string>` |
| `Csv.fromBytes` | `S.Codec<CsvTable, Uint8Array>` |
| `Csv.recordsFromString` | `S.Codec<ReadonlyArray<Record<string, string>>, string>` (header first) |
| `Csv.schema` | `TextDecodeTo<CsvReadOptions>` via `makeTextDecodeTo(recordsFromString)`, widened to `unknown` at that boundary as Yaml and Jsonc do |
| `Csv.bind` | `{ schema, decode, encode }` |
| `Csv.decodeString` / `Csv.decode` | channels of `CsvRecordSlice` from text / bytes, failing with `CsvParseError` |
| `Csv.decodeSchema(row)` | channel adding `S.SchemaError`, as Effect's `Csv.decodeSchema` does |
| `Csv.encodeString` / `Csv.encode` | inverse channels |
| `Csv.sniff` | `(sample) => Result<CsvDialect, CsvParseError>` |

**`internal/` modules.**

| Module | Purpose |
| --- | --- |
| `machine.ts` | the only parser: push-based RFC 4180 plus lenient rules |
| `encoding.ts` | BOM and UTF-16 detection, UTF-8 validation with byte offsets, the 1252 decode and encode tables |
| `sniff.ts` | delimiter and terminator detection |
| `writer.ts` | quoting styles, formula guard, terminator and BOM policy |
| `diagnostics.ts` | raw carriers, offset → line/character |
| `limits.ts` | caps and the guard error, toml's pattern |

The adapter to `effect/encoding/Csv` lives in the oracle test file, not in `src`.

**Lifted from this repository versus new.**

| From | To | Change |
| --- | --- | --- |
| `src/web/lib/spreadsheet/csv.ts` decode (fatal UTF-8 → 1252) | `internal/encoding.ts` | add UTF-16, a streaming window, byte offsets; return the encoding as data |
| `csv.ts` trailing `[""]` pop | machine semantics | a final terminator never makes a record |
| `csv.ts` delimiter set and the "not comma" note | `internal/sniff.ts`, `DelimiterDetected` | own detection replaces papaparse's |
| `csv.ts` `MissingQuotes` fatal, `InvalidQuotes` warning | `UnterminatedQuote`, `StrayQuote`/`TextAfterClosingQuote` | same policy, now the package's lenient mode |
| `src/domain/Spreadsheet.ts` `maxFileBytes` (csv 10 MiB), `src/domain/ItemImport.ts` `maxStagedRows` 50,000, 200 columns | `CsvLimits` defaults chosen by the app | limits become options; the numbers stay app policy |
| `test/web/readInPieces.test.ts` | `Csv.property.test.ts` | seven fixed chunk sizes become a property over every split |
| `test/fixtures/spreadsheet/*.csv` (quoted, ragged, semicolon-CRLF, tab, utf8-bom, windows-1252), `public/samples/*.csv` | `test/fixtures/` | copied, with expected `CsvTable`s |
| `notImportedCsv` in `src/domain/ItemImport.ts`, `heldCsv` in `src/web/components/review/logic.ts` | `internal/writer.ts` | the app calls `Csv.stringify` with a BOM and the formula guard; today neither writer guards formulas |
| papaparse chunked parse | removed | |

### `@beep/xlsx`: schemas and codec types first

Design sketch (not compiled):

```ts
// design sketch — XlsxCell.schema.ts
export const XlsxValue = S.TaggedUnion({
  Blank: {},
  Text: { value: S.String },
  Number: { value: S.Finite },
  Boolean: { value: S.Boolean },
  Error: { code: XlsxErrorCode },            // LiteralKit of Excel error codes (Unverified: full list)
  Date: { serial: S.Finite, iso: S.String }, // only when the numFmt is a date format; serial kept so encode is exact
})
export class XlsxCell extends S.Opaque<XlsxCell, { readonly brand: unique symbol }>()(
  S.Struct({
    column: S.Int,                           // 0-based
    value: XlsxValue,                        // for a formula: its cached value (Blank when none)
    formula: S.optionalKey(S.String),        // without "=", shared formulas expanded per cell
    numFmt: S.optionalKey(XlsxNumberFormat), // { id: S.Int, code: S.String }
  }),
) {}
export class XlsxRow extends S.Opaque<XlsxRow, { readonly brand: unique symbol }>()(
  S.Struct({ index: S.Int /* 1-based */, hidden: S.Boolean, cells: S.Array(XlsxCell) }),
) {}
export class XlsxWorksheet extends S.Opaque<XlsxWorksheet, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    state: XlsxSheetState,                   // LiteralKit(["visible", "hidden", "veryHidden"])
    dimension: S.optionalKey(XlsxRange),     // as declared; never trusted for extent
    rows: S.Array(XlsxRow),
    merges: S.Array(XlsxRange),
    hiddenColumns: S.Array(S.Int),
  }),
) {}
export class XlsxWorkbook extends S.Opaque<XlsxWorkbook, { readonly brand: unique symbol }>()(
  S.Struct({
    dateSystem: XlsxDateSystem,              // LiteralKit(["1900", "1904"])
    sheets: S.NonEmptyArray(XlsxWorksheet),
    definedNames: S.Array(XlsxDefinedName),
    dropped: S.Array(XlsxDroppedPart),       // what decode saw and did not model, by zip path and kind
  }),
) {}
```

The encoded side is `Uint8Array`. `fromBytes()` is `S.Uint8Array.pipe(S.decodeTo(XlsxWorkbook, SchemaTransformation.transformEffect({ decode, encode })))`. No exemplar shows a binary codec, so `makeBytesDecodeTo` is new code; it belongs beside `makeTextDecodeTo` in the vendored `@beep/utils/Schema`.

**Options.** `XlsxReadOptions = { sheets: "all" | names, cellFormula, richText, limits }`; `XlsxLimits = { maxCompressedBytes, maxUncompressedBytes, maxEntryRatio, maxSharedStrings, maxSharedStringChars, maxRows, maxColumns (16384), maxCellChars (32767) }`; `XlsxWriteOptions = { dateSystem, sharedStrings }`. The uncompressed and ratio caps are the zip-bomb guard the current reader lacks: today the only guard is 3 MiB of **compressed** bytes, and SheetJS inflates everything it meets.

**Error model.** `XlsxDiagnostic { code, message, part (zip path), line?, column?, cell? (A1) }`, positions coming from `Xml`'s `positions` option. Codes (`LiteralKit`): `NotZip`, `EncryptedWorkbook`, `LegacyXls`, `Xlsb`, `Ods`, `MissingPart`, `Truncated`, `ZipError` (wrapping Effect's kinds), `XmlError`, `InvalidCellReference`, `UnknownSharedString`, `UnknownStyle`, `InvalidNumber`, `LimitExceeded`, `StrictOoxml`. `XlsxParseError { diagnostics }`, `XlsxStringifyError { diagnostic }`.

**What round-trips honestly.** The law is value-level, never byte-level:

| Round-trips | Cannot round-trip |
| --- | --- |
| cell values and types, error codes | fonts, fills, borders, any style beyond numFmt |
| formula text and cached value | column widths, row heights |
| numFmt id and code per cell | charts, drawings, images, pivots, slicers, VBA, comments, conditional formatting, data validation, tables, external links, calcChain, theme, docProps |
| date serials (`iso` derived) | shared-strings order and identity; shared versus expanded formulas; inline versus shared strings |
| sheet names, order, state; merges; hidden rows and columns; defined names; date system | XML whitespace, prefixes, zip entry order, compression, timestamps, CRCs |

For every modelled workbook `w` with `dropped = []`, `decode(encode(w)) ≡ w` modulo derived fields; for every byte input `b`, `encode(decode(b))` is a valid workbook whose decode equals `decode(b)` with `dropped` cleared, so the round trip is idempotent after one pass. Unknown parts are **dropped and reported** in v1; opaque pass-through breaks as soon as `sheetN.xml` holds elements the encoder rewrites, so it waits for an edit-in-place use case.

**Streaming large files.** Two phases over random access:

```
bytes ─► internal/zipIndex.ts  (End-of-Central-Directory + ZIP64 locator; refuse encryption;
          │                     check size and ratio BEFORE inflating)
          ├─► small parts in full: [Content_Types].xml, workbook.xml + rels, styles.xml (numFmts, cellXfs),
          │                        sharedStrings.xml (capped)
          └─► one sheet entry ─► inflate ─► Xml.decode({ positions }) ─► Xml.elements([worksheet, sheetData, row])
                                                 ─► internal/sheet.ts ─► Stream<XlsxRow | XlsxSheetTrailer>
memory ≈ shared strings + one row + shared-formula masters (a MutableHashMap)
```

Merges sit in `<mergeCells>` after `<sheetData>`, so the stream ends with a trailer carrying them. `Xlsx.listSheets` reads only the workbook part and rels, which is all the sheet chooser needs; today every sheet is materialised even though one is used, which is why .xlsx costs about ten times CSV per row (about 180 MB of heap at 50,000 rows, measured in the app's own comments in `src/domain/Spreadsheet.ts`).

Inflating one entry: **recommend feeding the entry's local-header slice to `Zip.decode` and taking its body** (Effect's pure-JS inflater, no runtime requirement), with `DecompressionStream("deflate-raw")` as the alternative, both behind `internal/inflate.ts`. Unverified: `DecompressionStream("deflate-raw")` in workerd and Node 22. Writing is one-shot through `Zip.file` and `Zip.encode`, which require `CompressionStream("deflate-raw")` from the runtime, so `stringify` is an Effect, not a `Result`. If inflation is asynchronous, `parseResult` exists only for the synchronous inflater path; decide when `internal/inflate.ts` is chosen.

**Public API.** `Xlsx.parse`/`parseResult`, `Xlsx.stringify` (Effect), `Xlsx.fromBytes`/`XlsxFromBytes`, `Xlsx.sheetSchema(row, { sheet, header: "first" })`, `Xlsx.bind`, `Xlsx.listSheets`, `Xlsx.decodeSheet` (a `Stream`), `Xlsx.sniff` (identifies `LegacyXls`, `EncryptedWorkbook`, `Xlsb`, `Ods`, `NotZip`), plus the concept modules `XlsxAddress` (A1 parse and format, `columnLetter`), `XlsxSerial` (serial ⇄ ISO for both date systems; Unverified: the 1900 leap-year offset rule, to be checked against ECMA-376 before implementing) and `XlsxNumberFormat` (`isDateFormat`; Unverified: built-in date ids 14–22, 45–47).

**`internal/` modules.** `zipIndex.ts`, `inflate.ts`, `container.ts` (OLE and magic checks), `ooxml.ts` (content types, rels, local-name matching), `workbookPart.ts`, `sharedStrings.ts`, `styles.ts`, `numFmt.ts` (date-format detection, replacing SSF `is_date`), `serial.ts` (replacing SSF `parse_date_code`), `number.ts`, `sheet.ts` (cell types `s`, `str`, `inlineStr`, `n`, `b`, `e`, `d`; missing `r` attributes), `formula.ts` (shared-formula expansion), `xmlWrite.ts`, `diagnostics.ts`, `limits.ts`.

**Lifted versus new.** Lifted: the sniff knowledge and magic tables from `src/web/lib/spreadsheet/read.ts` (zip `50 4B 03 04` with `xl/workbook.xml`, `.xlsb`, `.ods`, Word; OLE `D0 CF 11 E0` with `EncryptedPackage` or `Workbook`), `numberText` (15 significant digits, no exponent), `dateText` and `columnLetter` from `src/domain/SheetLayout.ts`, and the fixture corpus with its expectations (`date-1904`, `empty`, `libreoffice`, `messy`, `no-header`, `old-format.xls`, `password`, `sheets`). New: everything else, including date detection and serial conversion that SheetJS's SSF does today. Fixtures to add: shared formulas, inline and `str` cells, rich text, Strict OOXML, `x:`-prefixed XML, a lying `<dimension>`, serials 59/60/61, time-only cells, booleans, xlsm, ZIP64, a deflate bomb.

**Pushback: is dropping SheetJS worth the number-format work?** The app uses SheetJS's formatted display (`shown`) for two things: the `leadingZeros` note (a number shown as `00123`) and display of dates. A general number-format renderer (sections, `#,##0`, `%`, `E+`, colours, locales) is a large piece of its own. **Recommendation: yes, drop SheetJS, but scope `shown` in v1 to zero-padding patterns and date formats**, which is exactly what the app's notes use, keep SheetJS in the app until the new package matches it on every fixture, and keep it afterwards only as a devDependency oracle (Unverified: its licence terms for that use). What is bought: a zip-bomb guard, one-sheet streaming instead of materialising every sheet, no third-party runtime code under the strict Effect profile, and a reader the server could run too.

**What stays in the app** (`catalog-model` for pure rules, `catalog-web` for the browser worker): format triage across PDF, PNG and HTML with person-facing wording; `SpreadsheetTable`, the 24 `NoteKind`s and every sentence; header search under title rows; labels for duplicate and empty headers; `extra` cells; blank, total and second-table heuristics; sheet choice and its explanations; `FileProblem` and `StagingOutcome`; `stageTable`, chunking, the upload protocol, the worker and Cancel. The adapter maps package error codes to `fileProblem.*`, package warnings to Notes, and `XlsxValue` to today's `Cell { type, text, shown?, formula? }`. A shared `tabular` package is premature: CSV cells are untyped strings, XLSX cells are typed and addressed, and the only shared primitive (A1 addressing) lives in `@beep/xlsx/XlsxAddress`.

## 4. Nineteen packages, one app, and a home for every current file

### The proposed tree

```
inventory-import/
├─ apps/
│  └─ inventory/                         app: Worker + SPA, one Vite build, wrangler, migrations, integration tests
├─ packages/
│  ├─ kernel/                            @inventory/kernel          ids, sign-in middleware, Activity line, HTTP middleware tags
│  ├─ access/
│  │  ├─ contract/                       @inventory/access-contract  people/identity/activity/allowance reads and commands
│  │  ├─ model/                          @inventory/access-model     role rules (last admin), ports
│  │  ├─ host/                           @inventory/access-host      D1 adapters, HTTP handlers, Better Auth wiring
│  │  └─ web/                            @inventory/access-web       sign-in, People, Activity screens
│  ├─ catalog/
│  │  ├─ contract/                       @inventory/catalog-contract items, import, review, suggestion, assistant contracts
│  │  ├─ model/                          @inventory/catalog-model    review, staging, search planning, view commands, reader adapter
│  │  ├─ host/                           @inventory/catalog-host     D1 stores, commit/take-back batches, model features
│  │  └─ web/                            @inventory/catalog-web      Import steps, Items, editor, upload worker
│  ├─ ui/                                @inventory/ui               vendored shadcn/tablecn/diceui + hooks (ui-system)
│  ├─ review/                            @inventory/review           the item-agnostic review region (ui-system)
│  ├─ drivers/
│  │  ├─ d1/                             @beep/d1                    statement/run/batch over @effect/sql-d1, test D1 harness
│  │  ├─ better-auth/                    @beep/better-auth           Auth service, signed-in user schema, auth route
│  │  └─ ai-sdk/                         @beep/ai-sdk                Ai service, routes, retry policy, toAiSchema
│  └─ foundation/
│     └─ modeling/
│        ├─ identity/ schema/ utils/     @beep/identity, @beep/schema, @beep/utils   vendored subsets
│        ├─ csv/                         @beep/csv
│        └─ xlsx/                        @beep/xlsx
├─ explorations/  goals/                 §7
├─ docs/                                 OKF bundle (product and engineering standards)
├─ scripts/                              development scripts only
└─ turbo.json  package.json  tsconfig.base.json  bunfig.toml
```

| Package | Layer | Purpose | Dependencies (workspace) |
| --- | --- | --- | --- |
| `@beep/identity`, `@beep/schema`, `@beep/utils` | foundation/modeling | the subset the format packages need: identity composers and annotations, `LiteralKit`, `makeTextDecodeTo` (+ new `makeBytesDecodeTo`) | none (each other, acyclically) |
| `@beep/csv`, `@beep/xlsx` | foundation/modeling | §3 | `@beep/identity`, `@beep/schema`, `@beep/utils` |
| `@beep/d1` | drivers | `Sql.ts` helpers as a service, `D1Client` layer construction, the `wrangler` platform-proxy test database | modeling |
| `@beep/better-auth` | drivers | `Auth` service and route; role mapping passed in, not hard-coded | modeling |
| `@beep/ai-sdk` | drivers | `Ai` service, model routes and fallbacks, retry policy, schema bridging; `AiStatus`/`AiTrouble`/`AiUnavailable` move here out of `src/api/v1/Api.ts` | modeling |
| `@inventory/kernel` | kernel (language only) | `OrganizationId`, `MemberId`, `Role`, `hasRole`, `RequestId`, description annotations, sign-in middleware declaration providing the member (the doctrine's kernel `.middleware.ts` role), `SameOrigin`/`ProblemDetails` tags, `Activity` line schema | modeling |
| `@inventory/<ctx>-contract` | contract | Schemas of commands, rejections, reads; the HTTP API group of the context | kernel, modeling (Alchemy domain only if decision 1 adopts it) |
| `@inventory/<ctx>-model` | model | pure rules and decisions; ports (`.store.ts` with memory twin, `.external.ts`); purity type | own contract, kernel, modeling, `@beep/csv`/`@beep/xlsx` (catalog) |
| `@inventory/<ctx>-host` | host | adapters over drivers, HTTP handlers, the context's Layer | own model and contract, other contexts' contracts, drivers |
| `@inventory/<ctx>-web` | web | screens over the contract's client | own contract, `@inventory/ui`, `@inventory/review`, kernel |
| `@inventory/ui`, `@inventory/review` | foundation/ui-system (app-owned) | design system; review region | modeling (review); none (ui) |
| `apps/inventory` | app | assembles the HttpApi from context groups, composes Layers, Worker entry, SPA shell, migrations, wrangler, integration tests | hosts, webs, kernel, drivers |

Notes on the cuts. **No `foundation/capability` package is created**: `TableView`, search planning, chunked upload and telemetry are each used by one consumer, so they fail F4's two-consumer gate and stay in a context or the app. **Telemetry runtime stays in the app**, beep-effect has its own `@beep/observability` capability, and the local Grafana stack (`telemetry/compose.yaml`) and remote Turbo cache belong with the infrastructure report's `@beep/infra`. **Cross-context call**: `catalog` needs the model allowance from `access`; it declares a port in `catalog-model`, and `catalog-host` implements it over `access-contract`'s gateway. The contract shape without Alchemy is Effect `HttpApiGroup` per context (the app already builds seven groups with `HttpApiGroup.make` and assembles them with one `HttpApi.make`); with Alchemy it is `Domain.Command` and friends, which the Alchemy domain-layer report owns.

### Where every current area goes

| Current | New home |
| --- | --- |
| `src/domain/Identity.ts`, `Described.ts`, `Activity.ts` (schema) | `@inventory/kernel` |
| the delegation types in `src/domain` (a model acting for a person, capped at their role) | `@inventory/kernel` (`.context.ts`) |
| `src/domain/Item.ts`, `ItemQuery.ts`, `ItemSearch.ts`, `TableView.ts` | `catalog-contract` (ids, fields, query and page reads) and `catalog-model` (readers, search planning, view-command rules) |
| `src/domain/ItemImport.ts` | split: `Staged*`, `stageTable`, `stagingProblem` → `catalog-model/Upload/`; `review`, `ruleFor`, decisions, `recheckRow` → `catalog-model/Review/`; field lists and labels → `catalog-contract`; `notImportedCsv` → calls `@beep/csv` |
| `src/domain/Upload.ts` | `catalog-model/Upload/` (no longer depends on item rules once `Staged*` moves) |
| `src/domain/Spreadsheet.ts`, `SheetLayout.ts`, `FileProblem.ts` | `catalog-model/Reading/` (the app adapter over `@beep/csv`/`@beep/xlsx`); limits that are format facts become package options |
| `src/domain/Suggest.ts` | `catalog-model/Suggestion/` |
| `src/api/v1/Api.ts` | dissolved: each group and its payloads to its context contract; AI status types to `@beep/ai-sdk`; `HttpApi.make` assembly to `apps/inventory` |
| `src/api/v1/Identity.ts`, `People.ts` | `access-contract` (`CurrentActor`/`Identity` middleware declaration to the kernel) |
| `src/api/v1/Assistant.ts` | `catalog-contract` |
| `src/api/v1/Security.ts`, `Version.ts`, `Document.ts`, `ModelTrouble.ts` | kernel (`SameOrigin` tag, API prefix); app (OpenAPI corrections); `@beep/ai-sdk` or `catalog-web` (model sentences) |
| `src/server/Sql.ts` | `@beep/d1` |
| `src/server/Auth.ts`, `authOptions.ts` | `@beep/better-auth`; the three-role mapping and table sharing to `access-host` |
| `src/server/Ai.ts` | `@beep/ai-sdk`; `answeredByRules` stays with the features |
| `src/server/ModelCalls.ts`, `Members.ts`, `People.ts`, `Activities.ts`, identity layers, `TestAccounts.ts` | `access-host` (stores as `.adapter.ts`, handlers as `.http.ts`) |
| `src/server/Imports.ts`, `Items.ts`, `ImportHandlers.ts`, `ImportShape.ts`, `Suggestions.ts`, `TableAssistant.ts` | `catalog-host` |
| `src/server/App.ts`, `handlers.ts`, `worker.ts`, `env.d.ts`, `Settings.ts`, `Observability.ts`, `RequestTelemetry.ts`, `Telemetry.ts`, `SameOrigin.ts`, `security.ts` | `apps/inventory` (Settings split per driver where it names a driver's config) |
| `src/web/main.tsx`, `App.tsx`, `Workspace.tsx`, `preload.ts`, `index.css`, `shadcn-utilities.css` | `apps/inventory/src/web` (the shell owns Tailwind's `@source` list) |
| `src/web/components/ui`, `src/web/hooks` | `@inventory/ui` (first invert its four imports of app code: `lib/route`, `lib/theme`, `lib/content-width`, `hooks/use-data-table`) |
| `src/web/components/review` + `src/web/lib/saved-progress/store.ts` | `@inventory/review` |
| `src/web/components/app` | shell parts → app; `StatusPill`, `Code`, `NotSet`, `PageHeader` → `@inventory/ui`; import/AI parts (`SheetChooser`, `ProposedValue`, the model-run panel, `TableAssistant`) → `catalog-web` |
| `src/web/lib/spreadsheet`, `lib/upload` (incl. `reader.worker.ts`), `imports.ts`, `draft.ts`, `table-assistant`, `queries.ts` | `catalog-web` (keep `new URL("./reader.worker.ts", import.meta.url)` beside the worker file) |
| `src/web/lib/actor.ts`, `auth-client.ts`, `early.ts` and the signed-in-state module beside them | `access-web` |
| `src/web/lib/api.ts`, `runtime.ts`, `errors.ts`, `optimistic.ts`, `route.ts`, `theme.tsx`, `telemetry.ts`, `otlp.ts`, `traceContext.ts`, `devtools.ts`, pure helpers (`content-width`, `text-width`, `rollback`, `form`, `dates`) | app shell or `@inventory/ui`, by whether a context screen imports them |
| `src/web/pages/ImportPage.tsx`, `pages/import/*`, `ItemsPage.tsx`, `ItemEditor.tsx` | `catalog-web` (`.screen.tsx`) |
| `src/web/pages/PeoplePage.tsx`, `ActivityPage.tsx`, `SignIn.tsx` | `access-web` |
| `src/web/pages/ReviewGallery.tsx`, `pages/gallery/*` | `@inventory/review` test fixtures and a development page in the app |
| `test/domain/*` | each package's `test/` (reader tests to `@beep/csv`/`@beep/xlsx` and `catalog-model`) |
| `test/server/*.test.ts` (fast) | the host or driver package they test |
| `test/server/*.slow.test.ts`, `test/server/support/*` | `apps/inventory/test` (they need the Worker composition, real migrations and samples) |
| `test/web/*` | `catalog-web`, `@inventory/review` (`reviewParity` stays where browser and server review meet: `catalog-model`) |
| `test/fixtures/spreadsheet/*` | `@beep/csv` and `@beep/xlsx` fixture corpora, copied |
| `test/scripts/*`, `test/tooling/*`, `test/fixtures/profiles/*` | deleted with the timed-workflow tooling |
| `scripts/` timed-workflow tooling (clock, checkpoint, pack, image budget, activity-log hook and report) | deleted, with the hook entries in `.claude/settings.json` that call them |
| `scripts/` development (`migrate-local`, `dev-accounts`, `dev-https`, `deploy-setup`, `auth-schema`, `check-production-identity`, `check-strict`, `reachable-sources`, `bundle-report`, `lighthouse`, `docs-check`, `telemetry`) | `apps/inventory/scripts` for app-specific ones; root `scripts/` for repository checks |
| `migrations/` | `apps/inventory/migrations` (wrangler reads one directory; each context owns its tables by convention, recorded in a header per table) |
| `docs/` | stays an OKF bundle; process-only standards are removed; per-package docs move beside packages |
| `public/` | `apps/inventory/public` (samples also copied into package fixtures) |

## 5. Copy beep-effect's flags verbatim; stage its Effect severities

### Compiler options to adopt

| Option | Value | What it enforces | inventory-import today |
| --- | --- | --- | --- |
| `strict` | `true` | the strict family | same |
| `exactOptionalPropertyTypes` | `true` | `x?: T` refuses an explicit `undefined` | same |
| `noUncheckedIndexedAccess` | `true` | index access yields `T \| undefined` | same |
| `noUnusedLocals` / `noUnusedParameters` | `true` | unused names are errors | same |
| `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch` | `true` | `override` required; every path returns; no fallthrough | same |
| `allowUnreachableCode` / `allowUnusedLabels` | `false` | unreachable code and unused labels are errors | same |
| `verbatimModuleSyntax` | `true` | type-only imports must say `import type` | same |
| `erasableSyntaxOnly` | `true` | no enums, namespaces or parameter properties | same |
| `moduleDetection` | `force` | every file is a module | same |
| `allowImportingTsExtensions` | `true` | `.ts` specifiers | same |
| `noErrorTruncation`, `skipLibCheck` | `true` | full type text; skip dependency `.d.ts` | same |
| `target` / `lib` | `ES2025` / `["ESNext"]` (+ `DOM` in web packages) | language level; no DOM globals unless opted in | `es2023` / `ES2023` |
| `module` / `moduleResolution` | `NodeNext` in foundation, drivers, kernel, contracts and models; `esnext`/`bundler` in web packages and the app | explicit-extension ESM | `esnext`/`bundler` |
| `types` | `[]` in foundation; explicit lists elsewhere | no ambient `@types` leak | explicit per project |
| `composite`, `incremental`, `declaration*`, `${configDir}` outDir/rootDir | **not adopted** | library emit | packages are consumed as TypeScript source by Vite; nothing emits declarations |

Measured by a dry type-check into a scratch directory outside the repository, using beep-effect's own Effect-patched `tsrs` (0.25.0 with `@effect/tsgo` 0.70.0): **0 plain TypeScript errors** under beep-effect's flags. Switching the server sources to `NodeNext` with `types: []` added 14 errors, all from `import.meta.env` losing its type without `vite/client` (8 × TS2339 in `src/server/App.ts`, `RequestTelemetry.ts`, `security.ts`, `worker.ts`, plus 6 `strictBooleanExpressions` on the resulting `any`); NodeNext itself added none, because every relative import already ends in `.ts`. So the app keeps `vite/client` and bundler resolution; packages that never read `import.meta.env` take NodeNext.

### Effect language-service settings to adopt

| Plugin option | Value | Effect |
| --- | --- | --- |
| severities | 145 rules `error`, 5 `off` (`apiStabilityLeak`, `experimentalApiUsage`, `preferBarrelImport`, `preferNamespaceImport`, `unstableApiUsage`) | inventory-import has 56 `error`, 86 `suggestion`, 5 `off`, and lacks three rules (`flatMapProvideServiceToProvideServiceEffect`, `forLoopPushToForEach`, `missingConcurrencyOption`) |
| `ignoreEffectSuggestionsInTscExitCode` | `false` | suggestions fail the exit code (today: `true`) |
| `includeSuggestionsInTsc` | `true` | suggestions print (today: `false`) |
| `overrides` | `[]` in beep-effect | today: `src/web/**` and config files switch 24 rules off; `src/web/components/ui/**` switches 147 off |
| `namespaceImportPackages` | `["effect", "@effect/*", "@beep/*"]` | no diagnostic effect while `preferNamespaceImport` is off |
| `importAliases` | `{ Array: A, Option: O, Predicate: P, Record: R, Schema: S, Equal: Eq }` | completions and code-fix naming (Unverified: no diagnostic effect) |
| `keyPatterns` | default service/custom patterns, `skipLeadingPath: ["src/"]` | `deterministicKeys` derives keys from the package name and path |
| versions | `@effect/tsgo` 0.70.0, `tsrs` 0.25.0, `prepare` patching `--tsrs` too, scripts calling `tsrs` directly | today 0.68.1, 0.24.0, the `effect-tsgo tsrs` proxy |

### What the current code fails

Same dry run, beep-effect's full profile, no overrides: **2,167 unique errors, all Effect diagnostics**. 1,423 (66 %) are in vendored `src/web/components/ui` (55 files); **744** are in own code (92 files): web 679, server 26, api 12, domain 1, test 26. inventory-import's own profile passes the same method with 0 errors.

| Rule (own code only) | Count | Vendored | Example |
| --- | --- | --- | --- |
| `preferEffectArray` | 443 | 381 | `Array.isArray` in `src/api/v1/Document.ts:44` |
| `preferEffectString` | 113 | 130 | `startsWith`/`slice` in `src/api/v1/Document.ts:51-52` |
| `preferEffectRecord` | 39 | 28 | `Object.values` in `src/api/v1/Document.ts:31` |
| `missingPipeableSignature` | 39 | 38 | `fileProblemTitle` in `src/domain/FileProblem.ts:76` |
| `globalJson` | 23 | 13 | `JSON.stringify` in `src/web/components/app/TableAssistant.tsx:51` |
| `deterministicKeys` | 19 | — | service keys carry the old package-name prefix while the rule derives `inventory-import/...` (`src/server/Activities.ts:24`) |
| `missingConcurrencyOption` | 16 | — | `Effect.forEach` without `concurrency` in `src/server/Imports.ts:588` |
| `strictBooleanExpressions` | 12 | 783 | `src/web/components/app/AppShell.tsx:53` |
| `asyncFunction` | 12 | 13 | `src/web/lib/actor.ts:108` |
| `globalDate` | 7 | 12 | `src/web/lib/dates.ts:8` |
| `globalConsole`, `globalFetch`, `yieldInCallArgument` | 5 each | 1, 0, 0 | `src/web/lib/api.ts:25`, `test/domain/ItemImport.test.ts:30` |
| `cryptoRandomUUID` (+ in-Effect) | 4 | 1 | `src/web/lib/api.ts:102` |
| `unnecessaryArrowBlock`, `flatMapToMap` | 1 each | 14, 0 | |

Two readings matter. Eighty per cent of own-code errors (595) are the three `preferEffect*` style rules, which today are `suggestion` everywhere and `off` in web. And server, api and domain together have only 39, plus 26 in tests: the back end is already close.

### Staged adoption (a recommendation, not a measured fact)

| Stage | Scope | Profile | How the app stays green |
| --- | --- | --- | --- |
| A | every new package from its first commit: `@beep/*` foundation and drivers, kernel, contracts, models | beep-effect's, no overrides | nothing to fix; new code is written to it |
| B | moved server, api, domain and test code | full profile at move time | fix the 65 findings as files move. `deterministicKeys` resolves itself because keys are rewritten for the new package names anyway (Unverified: how the rule derives a key from a scoped name such as `@inventory/catalog-host`) |
| C | own web code in `*-web`, `@inventory/review`, the app shell | full profile minus a **ledgered override** for `preferEffectArray`, `preferEffectString`, `preferEffectRecord`, `missingPipeableSignature` | everything else is fixed on move (`globalJson`, `globalFetch`, `asyncFunction`, `globalDate`…); the override's error count is measured by the existing `scripts/check-strict.mjs` method and may only fall |
| D | `@inventory/ui` (vendored) | excluded: all rules off, recorded as a permanent exception | regenerating from a registry would undo local edits; rewriting 1,423 sites buys nothing |

beep-effect states "no per-file overrides"; stages C and D are deliberate exceptions and should say so in the tsconfig comment.

## 6. Turborepo needs seven package tasks and two root tasks, not 118

beep-effect runs 118 tasks over a 7,119-line `turbo.json` with hand-curated inputs, a repository CLI that builds every `turbo run` invocation, and a self-hosted remote cache. None of that scale applies. What transfers is three ideas: tasks with explicit inputs, a `transit` node so a dependency's source change invalidates its consumers' cached checks, and root tasks only for scripts that do not themselves call `turbo` (the rule from Turbo's bundled docs, `node_modules/turbo/docs/messages/missing-root-task-in-turbo-json.mdx` in beep-effect).

Why `transit`: packages here export TypeScript source and never build, so `check` has no `^build` edge. Without some `^` edge, Turbo would not fold `@beep/csv`'s source into `catalog-model`'s `check` hash, and a cached pass would survive a breaking change in its dependency. beep-effect solves this with a script-less `transit` task (`"dependsOn": ["^transit"]`) that other tasks depend on.

Design sketch (not validated against Turbo's schema; key names copied from beep-effect's `turbo.json` on Turbo 2.11.11):

```jsonc
{
  "futureFlags": { "globalConfiguration": true },
  "global": { "inputs": [".bun-version", "tsconfig.base.json", "!package.json"] },
  "tasks": {
    "transit":   { "dependsOn": ["^transit"], "inputs": ["$TURBO_DEFAULT$", "!**/*.md", "!test/**"] },
    "check":     { "dependsOn": ["transit"], "outputs": [] },                    // tsrs -p tsconfig.json && tsrs -p tsconfig.test.json
    "lint":      { "outputs": [] },                                              // oxlint (+ shadcn lint in web packages)
    "test":      { "dependsOn": ["transit"], "outputs": [] },                    // vitest, fast tests
    "test:slow": { "dependsOn": ["transit"], "cache": false },                   // app only: workerd + D1; one suite calls a live service
    "build":     { "dependsOn": ["transit"], "outputs": ["dist/**"] },           // app only: tsc + vite build + production-identity check
    "dev":       { "cache": false, "persistent": true },
    "//#format:check": { "outputs": [] },                                        // oxfmt --check over the repository
    "//#docs:check":   { "outputs": [] }                                         // OKF validator over docs/, explorations/, goals/
  }
}
```

Root scripts: `check` = `turbo run check lint test //#format:check //#docs:check`; `check:full` adds `test:slow build`; `dev`, `build`, `deploy` stay app scripts (`deploy` is never a Turbo task: it mutates remote state). The current one-line `check` chain (typecheck, two oxlint passes, oxfmt, image check, fast tests) becomes separately cached tasks; the image-budget check disappears with the timed-workflow tooling.

CI: one workflow on pushes to main and on pull requests: set up bun from `.bun-version`, `bun install --frozen-lockfile`, `bun run check:full -- --summarize`. Skip `--affected` at this size; local and remote caching do the same job with less configuration. Remote caching is optional and belongs to the infrastructure report's `@beep/infra` (beep-effect's cache is a self-hosted Worker with write access only on main pushes). One prerequisite: Turbo reads the `packageManager` field, which today says `npm@11.19.1` while both `bun.lock` and `package-lock.json` are committed; the npm path existed to prove a clean-copy install for the timed workflow. Recommendation: `bun` only (decision 12).

## 7. Five required packet files replace machinery built for 319 goals

beep-effect's packet system exists at fleet scale: 319 goal entries and 120 exploration entries, about 32,864 lines of `beep goals`/`beep explore` CLI code, two JSON manifest schemas, a doctor with a ratchet baseline, archive tombstones in a separate repository. A median live goal is 21 files and about 1,100 lines, of which roughly 250 to 300 are fixed overhead. Each machine-readable part answers a problem of scale or parallel writers (status drift across hundreds of packets, merge conflicts on a shared decision log, work reported done before CI was green). One owner with sequential work has none of those problems.

### Minimum files

```
explorations/<slug>/
  README.md        frontmatter: type: Exploration, title, description, status (active | parked | graduated | dropped),
                   stage (capture | research | shape | graduated), next, goals: []
                   body: Next open question; Trail (dated one-liners, newest first)
  CAPTURE.md       optional; append-only, Benjamin's words verbatim
  research/NN-<topic>.md   numbered reports (this file is research/04)
  DECISIONS.md     ## <date> — <slug>: Question / Answer / Rationale (rejected options, the recommendation given) / Reverse
  BRIEF.md         Problem, Appetite, Sketch, Rabbit holes, No-gos, Map (goal slugs, first slice, "later, when <gate>",
                   each part citing existing code or marked NET-NEW)
goals/<slug>/
  SPEC.md          frontmatter: type: Goal, title, description, status (active | done | dropped), from: explorations/<slug>
                   body: Objective, Non-goals (from No-gos), Constraints (from Rabbit holes),
                   Acceptance (checkboxes, each with the command or screen that proves it), Decisions (links to D-numbers)
  PLAN.md          steps with status, current blocker, closing note (what changed, what was learned)
```

The minimum exploration is README, DECISIONS and BRIEF (plus `research/` when there is research); the minimum goal is SPEC and PLAN. Frontmatter uses the OKF bundle's `type`/`title`/`description` keys, so one checker can validate both.

### Graduation rule

An exploration graduates when all four hold: (1) BRIEF has all five parts, appetite included (beep-effect's own model-first exploration had to add one late, its decision D60); (2) no open question blocks the first goal, and each deferred question is logged DEFERRED with a reason; (3) the Map names the goal, its first vertical slice, and cites existing code or NET-NEW for every part; (4) Benjamin says the brief matches, and that sentence is logged as a decision. Then create `goals/<slug>/SPEC.md` seeded from BRIEF, set the exploration to `graduated` with `goals: [<slug>]`, and **link, never copy**: CAPTURE, research and DECISIONS stay where they are, and gated Map rows stay as re-entry points.

### What is dropped, and why

| Dropped | Exists in beep-effect because | Replacement here |
| --- | --- | --- |
| `ops/manifest.json` (both kinds) | tooling reads 25-plus keys across hundreds of packets | frontmatter |
| `GOAL.md` launcher | compact launchers for a goal runner, duplicating SPEC by design | "read SPEC.md and PLAN.md" |
| `decisions/` one-file-per-decision and generated blocks | parallel writers conflicted on a shared tail | one DECISIONS.md, keeping the "Reverse" line |
| `history/reflections/` with schema frontmatter, harvest, OPPORTUNITIES | cross-tool improvement at fleet scale | PLAN's closing note |
| hosted completion gate, three-open-PR cap | a PR operator closing many goals in parallel | acceptance checkboxes |
| archive repository, tombstones, `paused`/`reference`/`superseded` | hundreds of terminal packets | three statuses; git history is the archive |
| event streams, ATLAS, INDEX, doctor ratchet | status drift across 120 explorations (only 5 event files exist even there) | `rg '^status:' explorations goals` |
| `research/SOURCES.md` ledger | porting from many outside repositories with licence discipline | a Sources section in the report that ports |
| INBOX, `hold-ledger/`, `harness-ledger/`, root `research/`, `scratchpad/` package | specific automations; packets do not depend on them | an exploration with only CAPTURE; prototypes under `explorations/<slug>/prototype/` |

`explorations/ideal-architecture/` fits as is: add README and DECISIONS, treat `research/01`–`04` as its research stage. Whether `explorations/` and `goals/` stay at the root (with `docs:check` extended to them) or move under `docs/` is decision 11; extending `scripts/docs-check.sh` beyond `docs/` is Unverified as feasible.

## 8. Nine moves, each proved by the same import of the messy sample

Every step ends with the same proof bundle unless the row adds to it: `turbo run check lint test test:slow build` green; `bun run dev` signs in as the first test account; the messy sample (`items_messy.csv`, 200 data rows) is imported through every step in a real browser to Confirm, and three numbers are read and agree: rows in the file, what the result screen says, what is stored. Moves keep re-export shims at old paths until callers are rewritten, so no step needs a second step to compile.

| Step | What moves | Additional proof |
| --- | --- | --- |
| 0. Clear the ground | delete timed-workflow tooling (clock, checkpoint, pack, image budget, activity-log hook and renderer) with their tests, the `.claude/settings.json` hook entries that call them, and process-only documents; drop `check-images` from `check` | no hook fires a missing script; `bun run check:full` passes |
| 1. Workspace | bun workspaces and `turbo.json`; the whole app moves unchanged to `apps/inventory` (fix wrangler `main`, the `@` alias, tsconfig paths, vitest root, oxlint/oxfmt globs, script roots, `reachable-sources` walk); bun-only lockfile | a second `turbo run check` reports every task cached; the production build's CSS still contains a class used only in `components/ui` |
| 2. Toolchain | `@effect/tsgo` 0.70.0, `tsrs` 0.25.0, beep-effect's flags and severities in `tsconfig.base.json`, with stage C and D overrides for the app | the Effect error count outside the ledgered overrides is 0; the overridden count is recorded as the ceiling |
| 3. Vendored kit | `@beep/identity`, `@beep/schema`, `@beep/utils` subsets with a provenance header naming the beep-effect commit, and a check that each file's hash matches its recorded source | their copied tests pass under stage A |
| 4. `@beep/csv` | the package is built beside the reader; a differential test runs old reader and new adapter over every CSV fixture and both samples and requires identical `SpreadsheetTable`s; then `csv.ts` switches and papaparse is removed | `readSpreadsheet`, the chunk-invariance property, `reviewParity`, `ItemImport` tests |
| 5. Kernel and drivers | kernel; `@beep/d1` (with the test D1 harness), `@beep/better-auth`, `@beep/ai-sdk` (AI status types leave `Api.ts`) | `Auth`, `Tenancy`, `Imports`, `Ai` tests; sign-in and sign-out in the browser |
| 6. UI packages | invert the four ui → app imports, then `@inventory/ui` and `@inventory/review` (with `saved-progress/store.ts`); Tailwind `@source` extended to package folders | `lint:shadcn`; the production CSS check from step 1; the review region's undo and saved progress survive a refresh |
| 7. Contexts | `access` first (fewest edges), then `catalog`; each takes its schemas out of `Api.ts`, its services, handler groups, screens and tests; `Api` assembly and Layer composition stay in the app | People (add, change role, last-admin refusal) and Activity pages; then the full import and Items pages |
| 8. `@beep/xlsx` | the package beside SheetJS; the same differential test over every workbook fixture, scoped to the `shown` subset (§3); then `xlsx.ts` switches and SheetJS leaves runtime dependencies | the workbook suite of `readSpreadsheet`; heap at 50,000 workbook rows measured against today's 180 MB |

Splitting the Worker and the SPA into two apps is left out on purpose: one Vite build through `@cloudflare/vite-plugin` serves both, and splitting it changes `bun run dev` for no gain. Unverified: how `@cloudflare/vite-plugin` under Vite 8 resolves a Worker entry that imports workspace packages as TypeScript source, and whether `tsrs` handles a multi-package build with the same diagnostics; step 1 answers both before anything else moves.

## 9. Sixteen decisions only Benjamin can make

| # | Decision | Recommendation |
| --- | --- | --- |
| 1 | Adopt `@alchemy.run/domain` and event sourcing now, or take the model-first shape over state tables? | Shape now, D1 state tables behind model-declared ports; revisit once the Alchemy domain-layer report shows `Domain.Model` on Workers/D1. |
| 2 | How many contexts? | Two, `access` and `catalog`, each in the full doctrine shape; not nine slices, not contexts as folders inside role packages. |
| 3 | Where do `@beep/identity`, `@beep/schema`, `@beep/utils` come from, given they are `private: true` in beep-effect? | Vendor only the used subset under the same names and subpaths, with a provenance commit and a hash check, so code promotes back unchanged. |
| 4 | Filename postfixes in foundation packages? | Role suffix in every filename outside `internal/` and `index.ts`; concept-only public subpaths (`@beep/csv/Csv` → `Csv.codec.ts`). |
| 5 | Export `./internal/*` as the exemplars do? | No: exact exports only; internal tests import by relative path. |
| 6 | Who owns CSV in the beep-effect world? | The vendored `@beep/schema` here excludes its `Csv` concept; when `@beep/csv` is promoted into beep-effect it supersedes `@beep/schema/Csv`, which is retired in that change. |
| 7 | Ship the byte-lossless `CsvDocument` in v1? | No: canonical `CsvTable` codec plus channels in v1; the engine keeps quoting and terminators so the document can be added without engine changes. |
| 8 | Drop SheetJS? | Yes, after `@beep/csv`, behind fixture parity, with `shown` limited to zero-padding and dates; SheetJS kept only as a test oracle if its licence allows. |
| 9 | Package scope? | `@beep/*` for product-neutral foundation and drivers (checked for collisions against beep-effect first); `@inventory/*` for kernel, contexts, ui and the app. |
| 10 | Effect diagnostics adoption? | Staged A–D as in §5: strict for new packages, fixed on move for back-end code, a shrinking ledgered override for web style rules, vendored ui excluded. |
| 11 | Where do `explorations/` and `goals/` live? | At the repository root with OKF frontmatter, and `docs:check` extended to both roots. |
| 12 | Package manager? | bun only: `packageManager` set to bun, `package-lock.json` deleted. |
| 13 | Rename the starter's package name everywhere, including the sign-in cookie? | Yes, in step 0, if no deployment with signed-in users exists (the cookie rename signs everyone out). |
| 14 | Several hosts writing one `activity` table in their own atomic batches? | Accept as a recorded exception to "a context owns its data"; atomic audit beats projected facts here. |
| 15 | Keep `CurrentActor`, which the doctrine retires? | Keep it as the kernel's sign-in middleware providing the member; do not build an `authority` context. |
| 16 | Lenient or strict CSV by default? | Lenient for reading files a person brings; strict is an option and the oracle-tested mode. |

## Conclusion

The useful surprise is how little of the cost sits where the request put it. The compiler flags are already identical; the doctrine's edges already agree; the reader that looked liftable is two third-party libraries with good tests around them. The real work concentrates in three places: writing two parsers that the house rules forbid importing, getting Effect's diagnostics to error level in web code written under softer rules, and choosing contexts by invariant rather than by feature, which is what turns a 36-package projection into eight. Each of those is also where this repository can return evidence to beep-effect: the first model-first contexts outside a scratchpad, the first binary-encoded Schema codec, and a measured answer to whether the doctrine survives a host that is not Effect Cluster on Postgres.

The second implication is about order. `@beep/csv` is the right first package: it depends on nothing in the app, it proves the vendored kit, the strict profile, the exact-export rule and the postfix rule at once, and its differential test against today's reader is a cheap, exact definition of done. `@beep/xlsx` is the right last one, because it is the only piece whose scope (`shown`, Strict OOXML, inflation) can still grow, and nothing else waits on it.

## Unverified

- Unverified: whether `@alchemy.run/domain` can host a `Domain.Model` on Cloudflare Workers with D1 storage (owned by the Alchemy domain-layer report).
- Unverified: the content of the "Context as Topology" X post (HTTP 402); every postfix rule rests on `beep-effect/standards/ARCHITECTURE.md`.
- Unverified: whether beep-effect's model-first doctrine text is merged on its main branch or only on a working branch.
- Unverified: how `deterministicKeys` derives a key from a scoped package name such as `@inventory/catalog-host`.
- Unverified: that `importAliases` has no diagnostic effect.
- Unverified: the encoded form of `S.Option`, and the `S.check` predicate spelling for a one-character delimiter (both exports exist in effect 4.1.4).
- Unverified: whether workerd's `TextDecoder` supports `windows-1252` and `utf-16be`.
- Unverified: `DecompressionStream("deflate-raw")` availability in workerd, Node 22 and the target browsers.
- Unverified: papaparse's behaviour on mixed line endings when given an explicit `newline`.
- Unverified: SheetJS internals (shared-formula expansion, inline strings, 1900 leap-year handling, whether `!ref` comes from `<dimension>`), and its licence terms for use as a test oracle.
- Unverified: the full Excel error-code list, the built-in date numFmt ids (14–22, 45–47), and the 1900 leap-year serial rule; check against ECMA-376 before implementing.
- Unverified: throughput of Effect's `Csv`, `Zip` and `Xml` against papaparse and SheetJS; the 3 MiB workbook limit may need re-measuring.
- Unverified: how `@cloudflare/vite-plugin` under Vite 8 resolves a Worker entry importing workspace packages as TypeScript source.
- Unverified: whether `tsrs` handles a multi-package build with the same diagnostics configuration.
- Unverified: whether `scripts/docs-check.sh` can validate paths outside `docs/`.
- Unverified: whether any deployed copy with signed-in users exists (affects the cookie rename).
- Unverified: the `turbo.json` sketch against Turbo's schema beyond the keys copied from beep-effect.
- Unverified: the current `scripts/check-strict.mjs` output (not run; the counts above come from the separate dry run).
