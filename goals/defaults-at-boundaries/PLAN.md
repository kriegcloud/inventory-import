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
| 2 | `packages/catalog/model` (src and tests) | 347 | this session, by hand | done: no line of the baseline names it. The text a file cell gives the review is read in `Review/CellRules.rules.ts`; it and five files that compare words are exempt for clean-ups only (SPEC, questions 1, 2 and 4) |
| 3 | `packages/catalog/host` | 20 | this session, by hand | done: the number filters' trim is `TypedNumberText`'s, a contract schema |
| 4 | Agent files, `CLAUDE.md`, the skills README, `docs/patterns.md` and `docs/kit.md` examples | — | this session | done: `backend.md` has the boundary shape from `ImportStore.adapter.ts`; the README has the paths that stand in |
| 5 | The law's new kinds (SPEC, "What the law should count") | — | a lane in `packages/tooling` | done: items 1 to 3 counted (a test's branch on an Option, Result or Exit; a literal `onNone`; an unwrapped `optionalKey`). The 74 places they named in the pilot packages and the ontology's tests are cleared but for `Cell.shown` and `Cell.formula`. Decided 2026-11-25 and in a second lane: `onNone` narrowed to data stand-ins, `getOrThrow` and `runSync` counted, `Spreadsheet.rules.ts` exempt for absence |
| 6 | `packages/access/{contract,model,host}` | 37 | Codex lane | done in two rounds: the first cleared the law with `Result.getOrThrow` decodes and was refused. Left as on main: the session hook's null context and `undefined` result in `internal/authOptions.ts` (2 places, Better Auth's own API; an exemption candidate for row 15) |
| 7 | `packages/kernel`, `packages/drivers/*` | 18 | Codex lane | done in two rounds: a model policy and a script's options are stated by every caller; no line of the baseline names them |
| 8 | `packages/foundation/modeling/{csv,xlsx,vocabulary}` (our own; not the kit) | 186 | Codex lane | partly, in two lanes: 88 places cleared, 81 exempt in eleven files that read bytes and markup (decided 2026-11-26), 17 left in the two codecs and the xlsx schema files (sheet and column names compared without case; a codec's own cell reading) |
| 9 | `packages/review` | 586 | Codex lane | partly, in four lanes (the fourth made a row's cells total; 110 places left, see the evidence below): the region's optional data are Options from `ReviewRow` to the last step of each screen (321 of 474 source places), the tests narrow with asserts (74 of 94), and the browser's reads are in `internal/browser.ts` (exempt for absence, decided 2026-11-26). Left: about 120 in source, most in `internal/ReviewGrid.tsx` (50) and `ReviewRegion.atoms.ts` (19): sparse cell lookups (`view.cells[id] ?? ""`), counters, and a component's own optional props, which stay counted (decided 2026-11-26); 20 in two test fixtures the gallery imports, which cannot use the test asserts |
| 10 | `packages/client`, `packages/ui` (our own files) | 127 | Codex lane | partly, in three lanes: every caller states its reactivity keys, `keep`, toast lead and `sayError` fields; the browser's reads are in `client/src/Storage.browser.ts` and `ui/src/internal/browser.ts` (exempt for absence). Left: about 55, named in VERDICTS: `Effect.runSync` in `Json.codec.ts` and `Api.atoms.ts`, `ListTable`'s facet counts and search clean-ups, `SayError`'s path wording, and components' own optional props |
| 11 | `packages/catalog/web` | 572 | Codex lane | done but for 19 places in its tests and two in source: 292 of 324 source places cleared, the editor is Closed or Open, worker messages cross encoded; five files that show or repair a reviewed cell are exempt for clean-ups and `internal/browser.ts` for absence (decided 2026-11-26). Left in source: the table hook's page count before the first read (`ItemsPage.screen.tsx`) and a ReactNode check in `ImportPage.screen.tsx` |
| 12 | `packages/access/web` | 37 | Codex lane | done: no line of the baseline names it but the two exempt edges (`Session.atoms.ts`, `internal/authClient.ts`: the browser's and Better Auth's own APIs, decided 2026-11-26). The slug of a new organization is a schema's (`OrganizationSlugStem`), compared with the old helper on five names; not seen on screen, since sign-up is closed in development |
| 13 | `apps/inventory` (api, server, web, tests) | 142 | Codex lane | partly: tests 95 to 4 (a first round that read `.valueOrUndefined` was refused and redone; the law now counts it), source 51 to 18. Left: the OpenAPI document's JSON (`api/v1/Document.ts`), `SameOrigin`'s header reads, and gallery pages |
| 14 | `packages/infra` | 7 | Codex lane | done: 15 places under the new reader, all cleared; the stage plan is unchanged and no alchemy command was run. Two `onFailure: () => []` branches stay, which the law does not count |
| 15 | Edges named in `exemptions`; three files a new feature starts from checked for the boundary shape | — | this session | done: the edges are on `exemptions` as Benjamin decided each (2026-11-25, 2026-11-26 twice): the byte readers, Better Auth's and the browser's APIs, the reviewed cell's display files, four browser-edge modules. The Items example a new feature copies (CLAUDE.md, "Adding a feature") was run through the law: `Item.read.ts`, `ItemQuery.command.ts`, `Items.handler.ts`, `ItemStore.adapter.ts` and `ItemEditor.screen.tsx` hold no counted place; `ItemsPage.screen.tsx` holds one, the page count the vendored table hook wants before the first read |

## Where the pilot stands

Done on 2026-11-23. Baseline: 1,687 places in 204 files, down from 2,120 in 248; no line names the catalog's
contract, model or host. Benjamin answered the last round the same day (SPEC, questions 4 to 6).

Checked: `bun run check` and `bun run check:full` on the final tree, the Verify lock equal to `main`'s, the two slow
tests that write 50,000 rows, and on screen on a fresh database: `items_messy.csv` reviewed as 24 Needs a decision,
21 Cannot import and 155 Ready of 200; "Import 155 items" stored 155; the result reads Imported 155, Not imported 45,
Already there 0; the Items page says "155 items"; D1 holds 155 for Example Works (test). A read-only review of the
diff on four lenses (behaviour, performance, SQL, tests), each finding put to a skeptic, confirmed nothing.

Not checked: a number filter typed with spaces round it ("  12 ") on screen; the slow tests cover the filter.

**The app was broken between commits.** From `9f3a850f` to `9bc8f64e` every upload failed with "The file was not
saved": a staged cell's `shown` became an Option, and the reader worker's `postMessage` drops what makes it one. No
test crossed the worker, so every check passed. The fix encodes a chunk in the worker and decodes it in the page;
`ChunkCrossing.test.ts` holds the round trip. Each lane after this one runs an import on screen before it commits a
change to a schema that the browser sends.

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

- **A group's rows are read where they are, never copied.** `A.fromOption` then `A.flatten` over a group copied it
  on every row, which took a review of 50,000 rows from 1.2 s to 70 s and the slow tests past their limit. `O.match`
  to the group itself, with `A.empty` for none, brought it back to 1.2 s (measured against a copy of `main`).

- **What crosses `postMessage` is in the wire's form.** An Option, a class or a Data value loses its prototype in a
  structured clone. The head's sheet crossed as a name or null; a chunk of rows now crosses encoded by `StagedRow`'s
  schema and is decoded in `Upload.controller.ts`.

## Where the lanes stand

2026-11-26, on `feat/defaults-sweep` (worktree `.claude/worktrees/defaults-sweep`, from `main` at `8d5accaa`): rows 5,
6 and 7 merged. `bun run check:full` passes on the merged tree (112 tasks) and the Verify lock equals `main`'s. Not
seen on screen: no lane so far changed a schema the browser sends or receives.

2026-11-26, after rows 8 (first lane), 12 and 14 merged, on port 5174 from a fresh database, signed in as Dana
Whitfield: pressed "Use items_messy.csv"; Review read Needs a decision 24, Cannot import 21, Ready 155, All 200;
pressed "Import 155, skip 45", the dialog read "Import 155 items?" with "Fixed by a rule 17, Unchanged from the file
138"; pressed "Import 155 items"; Result read Not imported 45, Imported 155, Already there 0, All 200; Items read
"155 items"; People read "Example Works (test) · 3 people" with each person's email. Screenshot
`.scratch/shots/sweep-1-result.png`.

2026-11-26, after rows 9, 10, 11 and 13 and the browser-edge lane merged: the baseline names 55 files and 333
places (main: 1,687). `bun run check:full` passed on the tree before the browser-edge lane (112 tasks) and the Verify
lock equals `main`'s. On port 5174 from a fresh database, signed in as Dana Whitfield: pressed Continue on the open
`items_messy.csv`; Review read Needs a decision 24, Cannot import 21, Ready 155, All 200; pressed "Leave out 2" on
the SKU group and "Undo: 2 rows left out", and it read the same; pressed "Import 155, skip 45", the dialog read
"Import 155 items?" (Fixed by a rule 17, Unchanged from the file 138); pressed "Import 155 items"; Result read Not
imported 45, Imported 155, Already there 0, All 200; Items read "155 items". Opened "Edit Brass Washer M6", typed
2456 in Qty on hand, pressed Save: the row reads 2,456 BX. Pressed "Use items_messy.csv" again: Needs a decision 25,
Cannot import 21, Ready 0, Already there 154, All 200 (the changed item asks keep or replace). After the browser-edge
lane: pressed "Leave out 2" there, it read Needs a decision 21, Ready 2, Left out 2; reloaded the page, it read the
same and offered "Undo: 2 rows left out".


2026-11-26, the sweep's last state, at `744ce47c`: the baseline names 50 files and 295 places (136 fallback, 108
absence, 2 unwrap, 49 clean-up; main: 1,687). `bun run check:full` passes (112 tasks) and the Verify lock equals
`main`'s. On port 5174 from a fresh database: pressed "Use items_messy.csv"; Review read Needs a decision 24, Cannot
import 21, Ready 155, All 200; pressed "Import 155, skip 45", then "Import 155 items" in the dialog "Import 155
items?"; Result read Not imported 45, Imported 155, Already there 0, All 200; Items read "155 items". Screenshot
`.scratch/shots/sweep-3-result.png`. Not seen on screen: Match (the sample needs none), the table assistant, People
after the last lanes, sign-up, and a phone width.

2026-11-26, after a second round of six lanes run one after the other (app, foundation, review, ui and client, the
review region's total cells, catalog/web's last pass), at `54149b01`: the baseline names 34 files and 162 places (70
fallback, 68 absence, 1 unwrap, 23 clean-up; main: 1,687). By package: review 98 in source and 12 in tests, catalog/web
2 and 19, ui 16, apps/inventory 7 and 1, the csv and xlsx codecs 5, client 2. A review row's cells are a complete
record for the region's columns, built once where rows enter (decided 2026-11-26); drawing the grid for the 200-row
sample measured +0.6% unpinned and -2.0% pinned over 21 paired runs. What review still holds is mostly counters and
groupings whose folds measured 10% to 52% slower and were left, layout and navigation absence, and a component's own
optional props. No `!` non-null assertion is left in our own code; the four `schemaSync:off` comments are gone (seven
`@effect-diagnostics` comments remain: six tests that read a binary file, one in `packages/infra`). `bun run
check:full` passes (112 tasks) and the Verify lock equals `main`'s. On port 5174 from a fresh database: pressed "Use
items_messy.csv"; Review read Needs a decision 24, Cannot import 21, Ready 155, All 200; pressed "Import 155, skip
45", then "Import 155 items" in the dialog "Import 155 items?"; Result read Not imported 45, Imported 155, Already
there 0, All 200; Items read "155 items". Pressed "Use items_messy.csv" again: Needs a decision 24, Cannot import 21,
Ready 0, Already there 155, All 200; pressed "Leave out 2": Needs a decision 20, Ready 2, Left out 2; pressed Undo:
the first counts again. Screenshot `.scratch/shots/sweep-4-result.png`. Not seen on screen: typing in a cell, Match,
the item editor, the table assistant, People, Activity, and a phone width.

Found on the way, and not the sweep's: the generated property "with reloads, sign-outs and closed tabs taken up" in
`packages/catalog/web/test/Draft.machine.test.ts` has a rare counterexample that also fails on `main` (a 13-step
ordering after which row c is said to be decided since by someone else when only this tab wrote it). Its replay token
is in `VERDICTS.md`, in the review package's fourth lane. Nothing was changed for it.

What the lanes taught, beyond the pilot's list:

- **Two lanes that rewrite the same files conflict on every line both reshaped.** The review lane and the catalog/web
  lane each changed the tests the other's types forced; the merge took a lane of its own, briefed with what each side
  did. Cut such lanes one after the other, not side by side.
- **A lane wraps a value in `O.fromNullishOr` at each use when the owning type is another lane's.** The second pass
  over a package's tests, after its source carries Options, removes them.

- **A lane clears the law by renaming the question unless it is told not to.** `Result.getOrThrow(S.decodeResult(…))`
  for a fallback, a schema built inside a function to hold a default, an encode to get `undefined` back, a double
  negation for an `O.match`. Every brief now carries the forms refused and the forms wanted, and each diff is read
  for them before it is merged.
- **Codex cannot commit from its sandbox** (git's metadata is read-only even with the common dir added): a lane
  leaves its tree dirty and the orchestrator commits after reading the diff.
- **A third-party API's optional properties are spread with `R.getSomes`** (`...R.getSomes({ baseURL })`), and an
  Option sorts with `O.makeOrder`: no fallback is written for either.

## Evidence

- beep-effect lints study, 2026-11-23, at beep-effect `92be3a06`: read by a Codex lane from source, each claim with
  file and line; summarised in SPEC, "What beep-effect's lints cover". Kept outside the repository (it quotes
  beep-effect paths at length) in the session's `.scratch/defaults/port-study.md`.
- `typescript/no-unnecessary-condition`, type-aware, run on the catalog's contract, model and host: one finding,
  `model/src/Suggestion/Suggest.rules.ts:147`.

## New-kind pilot follow-up, 2026-11-25

The catalog pilot had 69 newly counted places: 34 literal `onNone` fallbacks, 28 test guards and seven unwrapped
optional keys. Ontology added five test guards. The follow-up removes 72 of those 74 places. Two remain:
`Cell.shown` and `Cell.formula` in `Reading/Spreadsheet.rules.ts`, plain optional keys crossing `postMessage`.
They are exemption candidates for Benjamin; the exemptions and baseline are unchanged. The other packages' lanes
remain open; this does not complete the goal or shrink the saved baseline.

- Empty arrays use `A.empty`; existing Option-of-array folds return the held array itself. Empty optional model
  arguments to the external driver use `Record.getSomes` at that edge.
- Nullable vendor cell keys retain an outer Option around their nullable wire value, so changing preference keeps
  null distinct from a missing key. Row extra/hidden defaults use `emptyWhenLeftOut`; `Row.make` constructs the
  reader's output and the affected staged-note fixture.
- `StoredDecisions.saves`, the twin's missing-update sort key and the reader's unnamed location carry their old values
  on schemas. Aggregate SQL count queries with no row die as an invariant defect. `MappingChoice.at` still uses the
  existing `stagedRevision` value; no Verify rule text changed.
- Expected test branches narrow with `assertTrue` from `@effect/vitest/utils`. Properties that include inapplicable
  input states name the domain precondition (for example a nonempty stock count or a list with an unused value), then
  assert presence. Helper state transitions fold their success/failure explicitly.

Evidence on this follow-up:

- The scoped defaults law reads filenames (passing directories reads no files). It holds the pilot files to zero
  fallback/test-guard findings and the two optional-key candidates above.
- Parent's independent existing `ImportsTwin.test.ts` passed: the messy sample reviews as 24 Needs a decision,
  21 Cannot import and 155 Ready and stores 155. The existing `Imports.slow.test.ts` passed on fresh D1, covering
  review, confirm, stored rows, reload, replace and take-back. Logs: `/tmp/defaults-pilot-twin-final.log` and
  `/tmp/defaults-pilot-d1-final.log`; these are local proof, not a hosted deployment or a new screen observation.
- Parent's separate Verify project passed again on the final source: one test in 175.72 s,
  `/tmp/defaults-pilot-verify-final.log`.
- `BoundaryDefaults.test.ts` checks omitted-key Row encoding/defaults and structured clone, full Row round-trip,
  vendor missing/null preservation through `withPreferred`, reader location text and StoredDecisions generation.
- The changed decoded Row shape forced three web test adaptations: `csvDifferential.test.ts` and
  `xlsxParity.test.ts` now encode the table before comparing the historical wire snapshots; `readSpreadsheet.test.ts`
  asserts an empty decoded `extra` array instead of an omitted key. All snapshot files remain unchanged. Their
  targeted runs pass (24 workbook parity cases, 12 CSV parity cases, 37 reader cases), as do the two
  `ChunkCrossing.test.ts` cases. `/tmp/pilot-parity.log` and `/tmp/pilot-web-forced.log` hold these checks.
- The four `BoundaryDefaults.test.ts` checks passed, `/tmp/pilot-boundary.log`.
- Final `bun run check --env-mode=loose` passed: 105/105 tasks, 3m1.004s, with no cached tasks. It includes
  catalog contract 100 tests, model 275 tests and five proof tests, ontology 132 tests, and catalog web 401 tests.
  No web test needed a second try. Log: `/tmp/pilot-check-final.log`.
  Temporary Bun install/cache and Wrangler registry paths were used because managed writable roots reject the
  workstation's default caches. The first completed check found the three forced web test adaptations above; after
  those were corrected, the final full check passed. No historical CSV/XLSX snapshot was re-recorded.
- `bun run docs:check` and `git diff --check` passed. The baseline SHA-256 remains
  `5bec5d1953f057216a8932febe38ea08157a27c290f16920372fb97c075741db`; the Verify lock remains
  `4b118da8a3dd67a567a1d25d3dbfe9fcfa8fdcebfe3796adadc3fea1bd8bcd66`.
  No new browser observation or hosted deployment was performed.

Needs the person: decide whether to approve the two Cell optional-key exemption candidates; the existing undecided
fallback list retains its prior behavior.
