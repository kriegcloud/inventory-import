---
type: Goal
title: Defaults at boundaries
description: Absence, starting values and clean-ups move out of code and onto schemas, one package at a time, until the defaults law's baseline names no contract, model or host package and no test, and every place left in web code is an edge the law names.
status: active
from: explorations/ideal-architecture
---

# Defaults at boundaries

Business code never asks "is it there?", never invents a value and never cleans one up. Each of those questions is
answered once, by a schema, where the value enters or where its type is declared, and the type carries the answer
from there. The rule is [schema-first](../../docs/standards/schema-first.md) SF-3 to SF-6; the law that counts what
is left is `bun run beep laws defaults`. The decisions this goal rests on are Benjamin's of 2026-11-23, recorded in
the exploration's decision log (below, Decisions).

The field verdicts for the first packages are in [VERDICTS.md](VERDICTS.md). The order of the work, who does each
part and where it stands are in [PLAN.md](PLAN.md).

## Objective

- `defaults-baseline.json` names no file of a contract, model or host package and no test. Every place still held in
  web code is an edge the law names by file and reason. If nothing is left, the baseline file is deleted.
- Each handler and adapter gets its working type from one decode at its boundary. No function in a model package takes
  a raw string and cleans it: a value that must be clean is a type only its schema makes (`SkuKey`, `SearchWords`).
- Every schema and state union in scope has a field verdict (VERDICTS.md), and the code matches it.
- The agents that write code here are told the rule and the law, and the skills' missing paths are named.

## Non-goals

- No product behaviour changes. A fallback that no decision backs keeps its value: the value moves onto the schema
  and is listed in "Defaults nobody decided" for Benjamin's ruling. A fallback that can never fire is deleted and the
  type tightened.
- No stored data changes. D1 columns stay as they are; an adapter decodes them into the new shape, and a JSON column
  keeps the form it is written in (a key left out while empty stays left out: `emptyWhenLeftOut`).
- A file cell the person reviews keeps its reader (decided 2026-11-23): its trim or change of case is a proposal shown
  as before and after, never a decode. Those readers live in the files `exemptions` names.
- Out of scope: `packages/tooling`, scripts, the scratchpad, and everything vendored (`vendor/`, the kit under
  `packages/foundation`, `packages/ui/src/components`, `packages/ui/src/hooks`). The vendored kit's tests stay as
  copied.
- No push, pull request or deploy until Benjamin asks.

## Constraints

- `bun run check` passes before every commit; `bun run check:full` before a package is called done. The app is never
  broken between commits: a reshaped contract schema lands in one commit with everything that reads it.
- The Verify lock (`packages/catalog/model/test/Catalog.lock.json`) does not change unless Benjamin says so. In
  `*.aggregate.ts` and `*.decision.ts` a value the prover must see stays written out in the case's `make`; where a
  constructor default would hide one, the file is listed under "Exceptions" with the reason.
- The messy sample stores 155 items through Confirm, and the result screen, the Items table and the stored rows agree,
  after every package.
- Every Effect API is checked in `node_modules/effect/src` (Effect 4.1.5).
- A transformation round-trips where the value is written back: what the adapter stores and what the export or the
  left-out-rows download writes is unchanged.

## Boundaries of the pilot packages

Where outside values enter `@inventory/catalog-contract`, `-model` and `-host`, and what decodes them. The other
packages' boundaries are listed at the start of each lane (PLAN.md), as part of its verdicts.

| Boundary | Where | Decoded by | Verdict |
| --- | --- | --- | --- |
| HTTP payloads and paths | `src/api/v1/Api.ts` over `Catalog.contract.ts` | HttpApi with the contract's schemas; `ProblemDetails` for a 400 | One decode; the handler trusts it. `ItemQueryParams.search` and `decidedSince` already default on the schema |
| Upload chunks (staged rows) | `POST /api/v1/imports/uploads/...` | `UploadChunk`, `StagedRow`, `StagedCell` | `StagedCell.shown` becomes an `Option` (absent for a CSV), with `shownText` beside the schema (derived) |
| D1 rows | every `SqlSchema` `Result` in `packages/catalog/host/src` | `ChangeRow`, `BatchRow`, `findDecisions`, `Stored` (suggestions), `ItemRow`, `Totals`, `OutcomeRow` and the rest | Each nullable column is an `Option` in the row schema (`S.OptionFromNullOr`); a legacy column's stand-in value moves onto the row schema and is listed below |
| Saved decisions (JSON in `importDecision`) | `findDecisions` → `RowDecision` | `RowDecisionFlags` → `RowDecisionParts` | Each flag `emptyWhenLeftOut`: decoded always present, stored form unchanged |
| Draft JSON columns | `Draft.choicesJson`, `movesJson`, `takenBackJson`, `headJson` | `ChoicesJson`, `MovesJson`, `TakenBackJson`, `StagedHeadJson` at the store's reads | Kept as text on `Draft`: the store compares the text in its SQL guards (a concurrency token), so it is decoded where it is read, once |
| File cells the person reviews | `Review/CellReading.rules.ts`, and the cell reading in `Review.rules.ts` and `Suggest.rules.ts` | Small readers that return a value or a reason | Exempt for clean-ups (decided). Their fallbacks and absence checks: question 1 below |
| JSON inside a cell (vendors, dimensions) | `DimensionsCell`, `VendorCell` in `CellReading.rules.ts` | `S.fromJsonString` | Optional keys become `Option` (`S.OptionFromOptionalKey`, `S.OptionFromOptionalNullOr` where `null` is real) |
| Model output | `Suggest.rules.ts` `SuggestAnswer`; the assistant's `ViewCommand` | `LanguageModel` with the schema | One decode; a name guess is a proposal, never written |
| Search text | `ItemQuery.search` → `ItemSearch.rules.ts` | none today: `searchWords` lower-cases and trims in the model | A `SearchText` schema whose decoded side is the words (SF-3); the model takes the words |
| Item editor form | `ItemForm` → `readItemForm` | none: the model trims each box | The boxes are trimmed by `ItemForm`'s schema (no person reviews a box's clean-up); `readItemForm` takes the clean form |
| Settings, session | `CurrentActor` | access context | Not in these packages |

## Defaults nobody decided

A fallback that no recorded decision backs. Its value moves onto the schema unchanged and is listed here, with how
many rows of `public/samples/items_messy.csv` it touches and one example. Benjamin rules on the list in one round
once the pilot's places have moved. The table grows as each package moves; "rows" is counted from the sample when
the value moves.

| File | Field | Value | Rows of the messy sample | Example |
| --- | --- | --- | --- | --- |
| `contract/src/Import/Change.read.ts` | `basis` of a stored proposal with no basis | `""` | 0 (only rows written before the column was kept) | none in the sample |
| `contract/src/Import/Change.read.ts` | `confidence` of a stored proposal with none | `"low"` | 0 (as above) | none in the sample |
| `contract/src/Import/Import.read.ts` | `MatchTakeBack.matched`, `reads`, `saved` on an entry stored before each was kept | to be read from their readers when moved | 0 | none in the sample |
| `contract/src/Import/Mapping.read.ts` | `ColumnMove.knownFrom` left out | read as revision 0 in `Rematch.rules.ts` | 0 | none in the sample |
| `model/src/Item/ItemEdit.rules.ts` | an empty Quantity on hand box in the item editor | `0` | not an import path; the import's empty quantity is decided ("Defaults to 0") | the editor, Quantity box cleared |
| `model/src/Catalog.memory.ts` | the in-memory twin's allowance | `40` calls | none (test twin); 40 is the decided allowance | `catalogMemory()` |

## What the law should count, beyond today

Read from beep-effect's lints (below) and from the pilot. Each is a change to `internal/defaultsCode.ts` and
`whatIsCounted`, so the baseline is written anew for the new reader (the law already does this when `reads` differs).

1. **A test's branch on an Option, a Result or an Exit around an expectation** (`if (O.isSome(x))`, `O.isNone`,
   `Exit.isSuccess`, `Result.isFailure` as an `if` or `?:` test in a test file), counted as an absence check. The
   test narrows with `@effect/vitest/utils` instead. First to add: it closes the standing test rule, and a skipped
   expectation is a real failure.
2. **`onNone: () => <literal>` in a contract, model or host package**, counted as a fallback: the escape a refused
   `?? 0` takes next. Literals only (a number, a string, `[]`, `{}`, `true`, `false`, `null`, `undefined`); a branch
   that returns anything else is not judged. Web code is left alone: `O.match` into what is drawn is allowed there.
3. **`S.optionalKey` whose result is not wrapped** by an `OptionFrom*`, a decoding default, `absentAsNone` or
   `emptyWhenLeftOut`, in a contract, model or host package, counted as an absence: an optional property on a decoded
   type.
4. **Named edges.** When a package reaches places that are truly edges (a vendored component's optional prop, a DOM
   API, a third-party API's optional property), each is written into `exemptions` by file, kind and reason, so the
   baseline can still reach empty and be deleted.
5. **A type-aware check on what is left.** oxlint 1.93 ships `typescript/no-unnecessary-condition` (type-aware,
   nursery). Run on the catalog model it found one `??` whose left side is never nullish
   (`Suggest.rules.ts:147`). Once a package's types are tight, turn it on in that package's lint, so a fallback left
   on a tightened type is an error without a law of ours.

Not added: a judgement of whether a value is "really" a default. The law refuses tokens; the verdicts live here.

## What beep-effect's lints cover, and what was taken

Read on 2026-11-23 at beep-effect `92be3a06`; the full study, with file and line for each claim, is in the PLAN's
evidence list.

| Tool | What it covers of SF-3 to SF-6 and the test asserts | Taken |
| --- | --- | --- |
| `SchemaFirst` (ts-morph detectors, a policy, a store, an inventory of 286 entries: 273 exceptions, 13 advisory) | SF-3 only as zero-argument `.trim()`/case calls inside an exported function that also decodes; SF-5 only as an `options`/`params` parameter with an object default; SF-4 only as an exported function whose annotated return names `null`. No detector for `??`, `getOrElse`, `onNone`, `optionalKey` without `OptionFrom*`, or a struct of optional parts that is a union | The ideas only: the law here already counts wider syntax per file against a falling baseline with no exception inventory. Items 2 and 3 above have no detector there to port |
| `EffectVitest` (15 rules on how Effect tests are written, a finding-membership baseline, `--files`) | Nothing of the narrowing rule: its `if`/`??` lists decide whether a scope has a later assertion, not whether a test narrows by hand | Written fresh as item 1 above. Its `--files` mode is the precedent the law already follows |
| `SchemaParityCodemod` (three rules) | API renames only: `optional` → `optionalKey`, `withDecodingDefault` → `withDecodingDefaultKey`, `OptionFromOptional` → `OptionFromOptionalKey`, and two LiteralKit renames. It never chooses absence, invents a default or rewrites `??` | Not ported: no rule fits this sweep, and the verdicts are not mechanical |

**Can an advisory finding fail beep-effect's check?** Yes, through the lint gate, not through `bun run check`. An
active advisory reaches `failWithReportedExit` (exit 1) in `SchemaFirstScan.ts`; `bun run check` there runs Turbo's
`check` with no SchemaFirst task, and the lints run as the `Heavy / Lint Policy` lane in CI. Four rule families
(`fn-schema`, `normalization`, `null-return`, `getsomes-struct`) are listed as non-blocking by policy. So beep-effect
has a blocking lint whose rules mostly do not reach the tokens that make up the problem, and an inventory where an
inconvenient finding becomes one more exception: 273 of them.

## Exceptions

Files where a constructor default would hide a value from the Verify prover keep it written out. None yet; each is
added with its reason when found.

## Questions put to Benjamin

All three answered on 2026-11-23, each as recommended
([decision](../../explorations/ideal-architecture/DECISIONS.md)):

1. A cell reader's fallbacks and absence checks are **not** exempt; only its clean-ups are. The JSON in a cell is
   decoded by its schema with `Option` fields, a regex group is read as an `Option`.
2. The cell reading in `Review.rules.ts` and `Suggest.rules.ts` moves to `Review/CellRules.rules.ts`, on `exemptions`
   for clean-ups.
3. `skuKey` moves to `Item/SkuKey.rules.ts`, on `exemptions` for clean-ups.

## Acceptance

- [ ] `defaults-baseline.json` names no file under `packages/*/contract`, `packages/*/model`, `packages/*/host` and no
      test (`bun run beep laws defaults`, then reading the baseline); every place left in web code is in `exemptions`
      with its reason.
- [ ] SF-3's, SF-4's and SF-5's own checks (their `rg` lines) find nothing in any package in scope outside schema
      definitions and named exemptions.
- [ ] `bun run check:full` passes; `git diff main -- packages/catalog/model/test/Catalog.lock.json` is empty, or
      changed only on Benjamin's word.
- [ ] The messy sample stores 155 items through Confirm, and the result screen, the Items table and the stored rows
      agree, seen on screen.
- [ ] `.claude/agents/backend.md`, `.claude/agents/frontend.md` and `CLAUDE.md` state the rule and name the law;
      `.agents/skills/README.md` says which of the skills' paths do not exist here and what stands in for each.
- [ ] VERDICTS.md matches the code; "Defaults nobody decided" has been put to Benjamin; PLAN.md says what was done,
      what was checked and what was not.

## Decisions

- [2026-11-23 — the defaults law: what stays on purpose, and the order of the sweep](../../explorations/ideal-architecture/DECISIONS.md)
