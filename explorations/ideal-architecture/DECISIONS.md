---
type: Decisions
title: Decisions
description: Ideal architecture decisions: open questions in the order they block work, and the answered ones with how to reverse them.
---

# Decisions

Open decisions are listed first, in the order they block work. Each names the report section that argues it.
Answered decisions move below with the date, the answer and how to reverse it.

## Open

### Round three: the model path

| # | Question | Recommendation | Source |
| --- | --- | --- | --- |
| 13 | A second vendor for confidence scores? | Not until a labelled calibration run shows a gain | 03 §7.3 |
| 15 | Do model-preselected values count as Ready? | No | 03 §7.8 |
| 16 | MCP for agents? | Own tools: reads plus proposal-only writes that need approval | 01 §3 |

### Round four: shipping

| # | Question | Recommendation | Source |
| --- | --- | --- | --- |
| 18 | Deploy unit? | `Cloudflare.Website.Vite`, exact version pin | 02 §10.1 |
| 19 | State store? | `Cloudflare.state()` | 02 §10.2 |
| 20 | Better Auth schema owner and secret? | Hand-written migration; secret minted per stage | 02 §10.4, §10.5 |
| 21 | Preview isolation and hostnames? | Separate Cloudflare account, `workers.dev` hosts | 02 §10.6, §10.7 |
| 22 | Model keys outside production? | None | 02 §10.8 |
| 23 | Email through Resend now? | Not now | 02 §10.9 |
| 24 | Repository rules as code? | Yes, in a workstation-only stack | 02 §10.12 |

## Answered

### 2026-11-18 — core

Question: what is the core of the rebuilt app? Answer: the model-first package shape over D1 state tables behind
ports. Rationale: Confirm and take-back stay one atomic write, and nothing rests on a beta engine; rejected were an
import aggregate on Alchemy now, and the full Alchemy domain with cluster. Reverse: move the import lifecycle onto an
aggregate once a published release contains `Decision`; only the host's confirm and take-back paths change.

### 2026-11-18 — shared kit

Question: where do `@beep/identity`, `@beep/schema` and `@beep/utils` come from? Answer: vendor the used subset under
the same names and paths, with the beep-effect commit recorded and a hash check. Rationale: they are private in
beep-effect; rejected were publishing them first and doing without them. Reverse: replace the vendored folders with
the published packages when they exist.

### 2026-11-18 — packages

Question: how is the app's code cut and named? Answer: two contexts, `access` and `catalog`, each as contract, model,
host and web; `@beep/*` for product-neutral foundation, drivers and infra; `@inventory/*` for kernel, contexts, ui and
the app. Rationale: items and imports share one atomic write; `@beep/ui` would collide with beep-effect's. Rejected
were one scope and a package per feature. Reverse: a context can be split when it gains its own invariant.

### 2026-11-18 — file naming

Question: which naming and export rule do new packages follow? Answer: a role suffix in every filename outside
`internal/` and `index.ts`; public paths name the concept only; exact exports, `internal/` never exported. Rationale:
the role is read at file-name time and one export rule is cheaper to check than two; rejected were copying the
exemplars exactly and keeping `./internal/*`. Reverse: add an export entry.

### 2026-11-18 — strictness

Question: how is beep-effect's Effect diagnostic profile adopted? Answer: staged. Full profile for every new package;
moved back-end code is fixed as it moves; web code gets a recorded override for four style rules whose count may only
fall; vendored ui is excluded. Rejected were fixing everything first and strict for new packages only. Reverse:
remove an override when its count reaches zero.

### 2026-11-18 — step 0

Question: what is cleared before the workspace move? Answer: the timed-build tooling, hooks and process-only skills
and documents are removed, and every placeholder name becomes `inventory`, the sign-in cookie included. Rationale:
nothing is deployed, so nobody is signed out. Reverse: git history.

### 2026-11-18 — client state (superseded 2026-11-19 by "client state, reversed")

Question: atoms or TanStack Query? Answer: TanStack Query for the rebuild; atoms later as their own goal. Rationale:
undo per change, invalidate-after-last-write and keep-previous-data paging have no atom equivalent yet. Reverse: a
goal that moves the web packages onto `@effect/atom-react`.

### 2026-11-18 — packets

Question: where do packets live and what gates a goal? Answer: `explorations/` and `goals/` at the repository root,
checked by `docs:check`. `goals/workspace-and-strictness` is accepted as opened; every later goal needs a `BRIEF.md`
and Benjamin's "the brief matches" first. Rejected were no sign-off gate and moving packets under `docs/`. Reverse:
move the folders and the check's roots.

### 2026-11-18 — CSV scope

Question: what does the first `@beep/csv` round-trip? Answer: a canonical table codec; the engine keeps quoting and
terminators internally so a byte-lossless document can be added without engine changes. Rejected: shipping the
byte-lossless document in the first version. Reverse: add the document codec.

### 2026-11-18 — CSV default

Question: lenient or strict reading by default? Answer: lenient, each oddity reported as a diagnostic; strict is an
option and is tested against Effect's own `Csv`. papaparse is removed once the old and new readers agree on every
fixture. Rejected: strict by default. Reverse: flip the default option.

### 2026-11-18 — csv brief

Question: does `BRIEF.md` for the goal `beep-csv` match? Answer: the brief matches, after it was rewritten to
`docs/standards/schema-first.md`. Rejected: the first version, which used optional fields, defaults in code and flat
literal flags. Reverse: reopen the brief before the goal's SPEC is ticked.

### 2026-11-18 — schema form

Question: which form does plain data take in the new packages? Answer: branded `S.Opaque` over `S.Struct`, as the
four exemplar packages; `S.TaggedError` for errors. Rejected: `S.Class`/`S.TaggedClass` for every data type.
Reverse: change the convention in the standard and the packages together.

### 2026-11-18 — kit licence

Question: which licence do the vendored kit copies carry? Answer: MIT, as each package's own LICENSE file in
beep-effect says. Rejected: Apache-2.0 from the package.json files, and waiting for beep-effect to be corrected.
Reverse: replace the licence files and notices in the vendored folders.

### 2026-11-18 — kernel-drivers brief

Question: does `BRIEF-kernel-drivers.md` for the goal `kernel-drivers` match? Answer: "The brief matches", with the
seven answers below, each the brief's recommendation. Reverse: reopen the brief before the goal's SPEC is ticked.

### 2026-11-18 — D1 driver

Question: what does `@beep/d1` build statements from? Answer: "Raw SQL, Model.Class rows". Rationale: every write that
matters is an atomic `D1Client.batch`, which Drizzle cannot express on D1 (`drizzle-orm/effect-d1` has no batch and
its transactions are refused), and the hard SQL stays raw either way; rejected were Drizzle for reads with raw batches
for writes, and Drizzle everywhere. `drizzle-orm` and `drizzle-kit` leave `apps/inventory`, and the Drizzle MCP
entries leave `.mcp.json` and `.grok/config.toml`; the Drizzle skill stays. Reverse: add `./Drizzle` to `@beep/d1` over
`drizzle-orm/effect-d1`, writes still through `D1.batch`.

### 2026-11-18 — AI driver name

Question: what is the AI driver called? Answer: "@beep/openrouter", at `packages/drivers/openrouter`. Rationale: named
after its engine, as beep-effect's `@beep/anthropic`; rejected were `@beep/ai` and `@beep/ai-sdk`. Reverse: rename the
folder, the package and its composer.

### 2026-11-18 — rules reach

Question: how far do the schema rules reach into the HTTP contract in this goal? Answer: "Kernel now, contract with
contexts": kernel types follow SF-1 to SF-9 now (ids branded and bounded, `Activity.agent` an `Option`); the contract's
`instant()` string fields become `DateTime` when their context moves. Rejected were everything now, and moving the
kernel types unchanged. Reverse: move the `instant()` fields in this goal.

### 2026-11-18 — CurrentActor

Question: is `CurrentActor` kept as the kernel's sign-in middleware? Answer: "Keep it, names unchanged": `CurrentActor`,
`Identity` and `requireRole` move into `@inventory/kernel` as they are. A recorded exception to beep-effect's doctrine,
which retires `CurrentActor`. Rejected were the `Session` rename and an `authority` context now. Reverse: rename, or
build `authority` and replace `requireRole` by grants.

### 2026-11-18 — kernel identity

Question: which identity root does the kernel use, given the vendored kit refuses an `@inventory` base? Answer:
"@beep/inventory/kernel/...". Rejected: an own composer for `@inventory`. Reverse: when `@beep/identity` gains a
second root upstream, re-vendor and switch the kernel's `internal/identity.ts`.

### 2026-11-18 — model route and retries

Question: is the Vercel AI Gateway route dropped, and does the model path never retry a bad structured answer, with
`effect` and every `@effect/*` package pinned exactly at one version? Answer: "Drop it", and the same answer confirms
both: never retry a bad answer (decision 14), exact pins at one version (decision 17). Rejected: keeping the gateway
through `@effect/ai-openai-compat`, one retry of a bad answer, caret ranges. Reverse: a second `ExecutionPlan` step,
guarded so a bad answer does not move to it.

### 2026-11-18 — model status types

Question: where do the model-status wire types (`AiStatus`, `AnsweredBy`, `AiTrouble`, `AiUnavailable`, the screen
sentences) live? Answer: "In the app's contract", until the contexts goal. Rejected: the kernel, and the driver.
Reverse: move them with the context that owns them.

### 2026-11-18 — LiteralKit in Worker code

Question: the vendored `LiteralKit` imports the `@beep/utils` root, which names Node types that clash with the Workers
ones, so `kernel-drivers` used `S.Literals` and `S.Union` in Worker-side packages; what now? Answer: "Fix the import,
then use LiteralKit". The vendored `LiteralKit.schema.ts` and `internal/builders.ts` import `@beep/utils/Array` and
`@beep/utils/Record` instead of the root: a deliberate patch against beep-effect `c5cebd5c9de7`, applied by
`scripts/vendor-beep.mjs` (`SOURCE_PATCHES`), recorded with its reason under `patches` in the package's `vendor.json`,
named in each file's first line, and reported by `vendor:check`. Every literal union and tagged union in
`@inventory/kernel`, `@beep/d1`, `@beep/better-auth` and `@beep/openrouter` is a `LiteralKit` again, with `.match`
holding the behaviour; the app's web profile no longer needs Node types either. Rejected: keeping `S.Literals` in
Worker code. Reverse: the patch disappears when beep-effect's `LiteralKit` imports the subpaths itself; re-vendor and
`patchSource` then fails loudly, which is the signal to delete the two `SOURCE_PATCHES` entries.

### 2026-11-18 — Drizzle skill

Question: keep the Drizzle agent skill now that Drizzle is out of the app? Answer: "Remove it". Rejected: keeping it
for a later Drizzle decision. Reverse: re-add it from its source with the skills tool.

### 2026-11-18 — ui-packages brief

Question: does `BRIEF-ui-packages.md` for the goal `ui-packages` match? Answer: "Matches, all recommendations": (a)
the review region's decision becomes the `RowPlace` tagged union in this goal, the stored draft keeping its bytes; (b)
exact exports for every vendored component and hook, checked by a script; (c) the shared screen pieces (`PageHeader`,
`Skeletons`, `ListTable`, `TableSearch`, `StatusPill`, `Code`, `NotSet`, `ProposedValue`, `proposalSource`,
`AgentRun`) go to `@inventory/ui` and the unused `RowCards.tsx` is deleted; (d) the stage C override per package with
the ceilings split and their sum capped at 678, the vendored hooks joining stage D; (e) the review gallery's fixtures
stay test data in the review package; (f) the theme tokens move to `@inventory/ui/theme.css`. Rejected: the union in
step 7, a wildcard export, the pieces split between review and the app, fixing every moved finding now, a fixtures
subpath, the tokens left in the app. Reverse: reopen the brief before the goal's SPEC is ticked.

### 2026-11-18 — contexts brief

Question: does `BRIEF-contexts.md` for the goal `contexts` match? Answer: "The brief matches", with every
recommendation: (C1) a ninth package, `@inventory/client`, holds the browser's contract-free plumbing; (A1) the
Activity page's shell stays in the app and each context supplies its views; (A2) removals answer "204 No Content";
(A3) "Accept both" wording changes (the add-person sentence names the email lower-cased; a join date that is not a
date reads "Not set"); (C2) "BigDecimal, canonical text" for the unit cost; (C3) "Remove it, 400 names the field" for
`ItemInvalid`; (C4) `access-contract` names the model-call purposes; (C5) `Model.Class` "Nowhere new"; (C6) every port
has a memory twin, `ImportStore`'s included. Reverse: reopen the brief before the goal's SPEC is ticked.

### 2026-11-18 — Model.Class (decision 11)

Question: where is `Model.Class` used? Answer: "Nowhere new" (contexts brief, C5): stored rows decode through each
host's private row schemas; the kernel's `Activity` stays the only `Model.Class`. Rejected: `Item` as a `Model.Class`
(research 03 §3.1), which cannot carry the brand. Reverse: give `Item` its variants in `catalog-host`.

### 2026-11-18 — Option and DateTime (decision 12)

Question: `Option`/`DateTime` fields or `null`/strings? Answer: `DateTime` for every timestamp and `Option` for every
absence, the wire keeping its `null`s (`S.OptionFromNullOr`) and its ISO text (contexts brief, settled with "the brief
matches"). Rejected: `DateTime` for timestamps only. Reverse: none planned; a field goes back to text only with a
recorded deviation.

### 2026-11-18 — an address that names no import

Question: the import page says, for an address whose `import=` is no id, "The address does not name an import. Check
the link, or choose a file."; keep the sentence, which the contexts brief did not have? Answer: "Keep it
(Recommended)". Rejected: sending the text to the server for its 400. Reverse: change the sentence in
`packages/catalog/web/src/ImportPage.screen.tsx`.

### 2026-11-18 — an edit refused before it is sent

Question: when a saved edit is refused before it is sent (a 33,000-character description), the toast says "Something
went wrong... Try again" and "Edit again" opens nothing; fix it now? Answer: "Fix it now (Recommended)": the form
names the field and its limit before saving, and "Edit again" reopens the editor with what was typed. Rejected:
leaving it for a later goal. Reverse: none planned.

### 2026-11-18 — Suggest fixes for a heading

Question: "Suggest fixes" appears only when some row cannot be imported, so a file with an unmatched heading and no
such row is never offered a column; change that? Answer: "Offer it for headings too (Recommended)": the button also
appears when a file column matched no field. Built with one narrowing, mine: it appears for such a column only while
some field still has no column, because with every field filled there is nothing a suggestion could do with it
(`offersSuggestions`, `packages/catalog/model/src/Suggestion/Suggest.rules.ts`). Rejected: leaving the button to
rows that cannot be imported. Reverse: drop the narrowing, or the heading case, in that one function.

### 2026-11-19 — next goal

Question: which goal follows `contexts`? Answer: "@beep/xlsx (Recommended)": a foundation package beside `@beep/csv`,
in the same fashion, his words for these packages being "representing the entire decoding <-> encoding two way
transformation as an effect/Schema codec". It replaces the SheetJS reader in `catalog-web`'s `internal/spreadsheet`,
which becomes the parity test and is then removed. The brief is [BRIEF-xlsx.md](BRIEF-xlsx.md); no goal is open
until he says it matches, and its six decisions (X1 to X6) are his. Rejected: "@beep/infra" and
"Stop here for now". Reverse: take step 9 first; nothing of step 8 is built.

### 2026-11-19 — Suggest fixes for a heading, the narrowing

Question: the button is shown for an unmatched column only while some field still has no column, a narrowing the
agent made; keep it? Answer: "Keep the narrowing (Recommended)". It is now Benjamin's choice. Rejected: "Show it for
any unmatched column". Reverse: drop the second condition in `offersSuggestions`
(`packages/catalog/model/src/Suggestion/Suggest.rules.ts`).

### 2026-11-19 — xlsx engine (X1)

Question: what inflates the archive and reads the XML in `@beep/xlsx`? Answer: "Effect's Zip and Xml
(Recommended)", each behind one internal file, `effect` pinned exactly. Rejected: our own inflater and XML scanner;
keeping SheetJS wrapped in the schemas. Reverse: replace `internal/container.ts` or `internal/ooxml.ts`; nothing
else imports the two modules.

### 2026-11-19 — xlsx writing (X2)

Question: what does the first version write? Answer: "The workbook's values (Recommended)": cells with their kinds,
formulas and saved results, number formats, the date system, sheets, merged ranges, hidden rows and columns;
everything else read is named in `dropped` and not written. Rejected: read only; values plus unknown parts carried
through. Reverse: add the carried-through parts when a use edits a workbook in place.

### 2026-11-19 — xlsx displayed text (X3)

Question: for which number formats is a cell's displayed text worked out? Benjamin first chose "Something else" and
typed nothing; asked again ("For X3 you chose "Something else": which number formats should get displayed text?") he
typed: "Use the recommendation". So: dates and times, zero-padding and one plain number pattern (digits with
optional thousands separators, fixed decimals, a percent sign, a literal prefix or suffix); any other format gives no
displayed text and one Note names it. Rejected: dates and zero-padding only; every format Excel has. Reverse: widen
or narrow `internal/numberFormat.ts`; nothing else knows the grammar.

### 2026-11-19 — xlsx unreadable cell (X4)

Question: what happens to a cell the file itself gets wrong (a shared string that is not there, text where a number
belongs)? Answer: "Read the rest, tell the person (Recommended)": the cell is `Unreadable`, the row is read, and a
Note names the cells. Rejected: refuse the whole file. Reading the cell as empty without a Note was not offered: the
brief listed it only to reject it. Reverse: make `UnreadableCell` a fatal finding.

### 2026-11-19 — xlsx size (X5)

Question: how large may a workbook be? Answer: "Keep 3 MiB, cap 64 MiB inflated (Recommended)". Rejected: 10 MiB
with a 200 MiB cap; 3 MiB with no cap. Reverse: change `maxFileBytes.xlsx` and `XlsxLimits`' starting values, with
measurements from the new reader.

### 2026-11-19 — SheetJS afterwards (X6)

Question: what becomes of SheetJS once the reader is swapped? Answer: "Keep as test oracle only (Recommended)": a
devDependency of `@beep/xlsx`, out of the browser bundle and both runtime manifests. Rejected: remove it entirely;
remove it and check with LibreOffice. Reverse: delete the oracle test and the devDependency.

### 2026-11-19 — xlsx brief

Question: does `BRIEF-xlsx.md` for the goal `beep-xlsx` match? Answer: "The brief matches (Recommended)", with X1 to
X6 as answered above. The goal is open at `goals/beep-xlsx`. Reverse: reopen the brief before the goal's SPEC is
ticked.

### 2026-11-19 — who builds xlsx

Question: who builds `@beep/xlsx`? Answer: "The same session (Recommended)", the one that wrote the brief, on its own
branch `claude/beep-xlsx`. Rejected: a fresh session. Reverse: hand the branch and `goals/beep-xlsx/PLAN.md` to
another builder.

### 2026-11-19 — xlsx merge

Question: how does `claude/beep-xlsx` reach main? Answer: "Merge locally, I push (Recommended)"; merged into local
main at `3253f2f`. Reverse: none planned.

### 2026-11-19 — where the new workbook reader differs from the old

Question: the new reader differs from the SheetJS reader in three places on purpose; which are accepted (an
unticked one is changed back)? Answer: all three ticked: "Rows outside the declared extent are read", "Displayed
numbers round half away from zero", "A time rounding up to midnight shows no PM". Nothing is changed back. Reverse:
the extent in the adapter's grid (`packages/catalog/web/src/internal/spreadsheet/xlsx.ts`), the rounding and the
carry in `packages/foundation/modeling/xlsx/src/internal/numberFormat.ts`.

### 2026-11-19 — the workbook reader's three new sentences

Question: keep the sentences for a cell that could not be read, a number format that is not shown, and a workbook
that unpacks to more than 64 MB? Answer: "Keep all three (Recommended)". Rejected: reword. Reverse: the two Notes and
the problem are written in `packages/catalog/web/src/internal/spreadsheet/xlsx.ts`.

### 2026-11-19 — xlsx licence notice

Question: `@beep/xlsx`'s number formats follow what SheetJS (Apache-2.0) displayed; say so? Answer: "Add a short
notice (Recommended)": one line in the package's README and in the number-format file's header, saying the format
behaviour follows SheetJS, which is also the test oracle. Rejected: no notice. Reverse: remove the two lines.

### 2026-11-19 — where a reader's warning shows

Question: a reader warning (such as "2 cells could not be read and were left empty: C4, C8") is visible only behind
the Activity button, and Review read "Import 25 items" with no word of it; where should a warning show before the
person imports? Answer: "Also on the Review step (Recommended)": a warning line above the table names what the
reader could not read, with the cells, before Confirm; plain information Notes stay behind Activity; it applies to
CSV warnings too. Row outcomes and counts do not change. Rejected: "Review, and the rows are flagged" (rows with an
unreadable cell moved to Needs a decision), and "Leave behind Activity". Reverse: remove `ReaderWarnings` from
`packages/catalog/web/src/ReviewStep.screen.tsx`.

### 2026-11-19 — after xlsx

Question: what follows `beep-xlsx`? Answer: "Write the infra brief (Recommended)":
[BRIEF-infra.md](BRIEF-infra.md) for step 9, written only; nothing built or deployed, no goal opened. Rejected:
clearing the open schema decisions first; stopping. Reverse: none needed, the brief changes nothing.

### 2026-11-19 — client state, reversed

Mine, in my words: "Also no react hooks where effect/reactivity + @effect/react-atom should can be used." and
"useEffect banned with no exceptions." (The package is published as `@effect/atom-react`.) This supersedes "client
state" of 2026-11-18, which kept TanStack Query for the rebuild and left atoms for later. What it means file by
file, the exact line of what stays a hook, and the five questions it leaves are in
[BRIEF-atoms.md](BRIEF-atoms.md); nothing is built, and the goal starts after the Effect-imports migration is merged.
Reverse: none planned.
