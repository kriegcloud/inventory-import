---
type: Plan
title: Defaults at boundaries, plan
description: The order of the defaults sweep by package, each lane's owner, where it stands, and the evidence behind the packet.
from: explorations/ideal-architecture
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance; [VERDICTS](VERDICTS.md) the field verdicts. Status is one of
`todo`, `doing`, `done`. Progress is `defaults-baseline.json` shrinking: `bun run beep laws defaults --write` at each
commit, and a package is done when no line of the baseline names it.

Branch `feat/defaults-at-boundaries`, from `main` at `e9772504`. Baseline then: 2,120 places in 248 files.

## Order

The catalog's contract, model and host packages first, by hand in one session, as the worked example (Benjamin,
2026-11-23). After it, one Codex lane per package (`gpt-6.1-sol`, medium), each with the pilot as its pattern, in
dependency order. Each lane writes its package's verdicts into VERDICTS.md first, runs
`bun run beep laws defaults <its files>` before it hands back (Codex has no edit hook), and formats only its files.
Places by package on 2026-11-23, from the baseline:

| # | Package | Places | Owner | Status |
| --- | --- | --- | --- | --- |
| 0 | The packet; `emptyWhenLeftOut` in `@inventory/kernel/Wire` | — | this session | done |
| 1 | `packages/catalog/contract` (src and tests) | 41 | this session, by hand | done: `skuKey` in its own exempt file, `Item/SkuKey.rules.ts` (SPEC, question 3) |
| 2 | `packages/catalog/model` (src and tests) | 347 | this session, by hand | doing: no fallback, absence or unwrap left in src or tests; 40 clean-ups in src wait on Benjamin (below). The text a file cell gives the review is read in `Review/CellRules.rules.ts`, exempt for clean-ups only (SPEC, questions 1 and 2) |
| 3 | `packages/catalog/host` | 20 | this session, by hand | doing: as the model, 3 clean-ups (`ItemStore.adapter.ts`'s query trims) wait on Benjamin |
| 4 | Agent files, `CLAUDE.md`, the skills README, `docs/patterns.md` and `docs/kit.md` examples | — | this session | done: `backend.md` has the boundary shape from `ImportStore.adapter.ts`; the README has the paths that stand in |
| 5 | The law's new kinds (SPEC, "What the law should count") | — | a lane in `packages/tooling` | todo |
| 6 | `packages/access/{contract,model,host}` | 37 | Codex lane | todo |
| 7 | `packages/kernel`, `packages/drivers/*` | 18 | Codex lane | todo |
| 8 | `packages/foundation/modeling/{csv,xlsx,vocabulary}` (our own; not the kit) | 186 | Codex lane | todo |
| 9 | `packages/review` | 586 | Codex lane | todo |
| 10 | `packages/client`, `packages/ui` (our own files) | 127 | Codex lane | todo |
| 11 | `packages/catalog/web` | 572 | Codex lane | todo |
| 12 | `packages/access/web` | 37 | Codex lane | todo |
| 13 | `apps/inventory` (api, server, web, tests) | 142 | Codex lane | todo |
| 14 | `packages/infra` | 7 | Codex lane | todo |
| 15 | Edges named in `exemptions`; three files a new feature starts from checked for the boundary shape | — | this session | todo |

## Current blocker

One question for Benjamin, put with the "Defaults nobody decided" round: a trim or a change of case in pure code that
reads no file cell (the table assistant's words, the search's words, the item editor's typed values, a heading's key,
the sheet layout's header keys, the twin's filters, the D1 adapter's search). As a schema transformation each needs a
decode in pure code, which `S.decodeSync` would do and the type-check refuses (`schemaSync`). 43 places in the pilot, in 7 files.

## Choices made along the way

- **A save's `over` is always there in code.** `SaveRequest.over` decodes to `{}` when left out and is left out of
  the wire while empty, so the handler, `overOfSave` and the browser's save read it with no fallback. A test that
  calls the handler or the client directly states `over: {}`, as a decoded request has it. Two properties that draw a
  `SaveRequest` now draw an `over` on every run, and each decision in it is drawn under the decision's own checks, so
  they allow 20,000 discarded draws instead of fast-check's 2,000 (`drawnWithWaits` in `Decision.property.test.ts`);
  six runs in a row passed.
- **Flags as written have a name.** `RowDecisionFlags` is the decoded type, every flag there; `RowDecisionFlags.Encoded`
  is the form a draft stores and a test writes (only the flags that say something). Tests that built partial flags
  use the second.
- **A file-problem's usual sentence is on its maker's input schema** (`NotASpreadsheetInput`, `UnreadableInput`, with
  `withConstructorDefault`), and a file of no bytes is its own maker (`emptyFile`) instead of `noValues` with no
  `where`.
- **`skuKey` stays a function for now.** As a schema transformation it needs `S.decodeSync` in pure code, which the
  type-check refuses (`schemaSync`); SPEC, open question 3.

- **`emptyWhenLeftOut`** (`@inventory/kernel/Wire`): a key decoded always present, left out of the encoded form while
  it holds its empty value. The kit's `ArrayKeyDefaultEmpty` encodes the key even when empty, which would change what
  a stored draft looks like; this keeps the stored form. Probed: decoding `{}` gives the empty values, encoding them
  gives `{}`, a full value round-trips, `make({})` starts empty, and the decoded type has no optional property.
- **Test narrowing works in every test project.** `assertSome` and `assertDefined` from `@effect/vitest/utils`
  type-check, lint and run in the app's `tsconfig.test.json` and `tsconfig.test-web.json` (both use Node and Vite
  types; no test project uses the Workers types). Probed with a throwaway test, then removed.
- **The verdict drafts outside the pilot were dropped.** Codex lanes drafted verdicts for every other package; they
  came back as pattern matches ("missing carries a distinct meaning" for a map that plainly starts at `{}`), so none is
  in the packet. Each lane writes its own package's verdicts, checked against the pilot.

- **A spreadsheet `Cell` keeps `shown` and `formula` as keys left out.** The table crosses the reader's worker by
  `postMessage`, where an Option loses its prototype (`web/src/internal/protocol.ts` says the messages are plain
  structured-clone values). `shownOf` and `formulaOf` (`Reading/Spreadsheet.rules.ts`) read them as Options where a
  cell is read.
- **A fallback that could never fire is a defect now.** The header row's first and last named cell, the header's
  place in the grid and the one row an aggregate answers were `getOrElse(…, 0)`; each is now `Effect.die` with what
  cannot happen, and the type is the value's own.
- **The store's optional arguments are required.** `decide(…, read, expected)` and `matchColumn(…, compare)` in the
  port, the twin and the D1 adapter: a caller that read nothing passes `noItemsRead`, `O.none()`, `noComparison`. The
  twin is `catalogMemory` (a Layer, `offline`) or `catalogMemoryWith(options)`.
- **A test builder starts from a named object.** The stories' `act`, `undo`, `group` and the rest take
  `Partial<typeof xStart>` and spread it over `xStart`, so a value a story leaves out is written once, with its
  reason, and never as `??` per field. The five test files that each built a staged table share `stagedTableOf`
  (`test/support.ts`).
- **A regular expression's group is read as an Option** (`groupAt` in `CellReading.rules.ts`, `groupOf` in
  `TableView.rules.ts`): `O.fromUndefinedOr(found[i])`, so a group the text left out is none and a group that must be
  there is joined with `O.all`.

## Evidence

- beep-effect lints study, 2026-11-23, at beep-effect `92be3a06`: read by a Codex lane from source, each claim with
  file and line; summarised in SPEC, "What beep-effect's lints cover". Kept outside the repository (it quotes
  beep-effect paths at length) in the session's `.scratch/defaults/port-study.md`.
- `typescript/no-unnecessary-condition`, type-aware, run on the catalog's contract, model and host: one finding,
  `model/src/Suggestion/Suggest.rules.ts:147`.
