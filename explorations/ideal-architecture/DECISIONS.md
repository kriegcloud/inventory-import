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

### Round four: shipping (answered 2026-11-19, entries "infra I1" to "infra I9" below)

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

### 2026-11-19 — infra I1, deploy unit (18)

Question: what is the deploy unit? Answer: "Cloudflare.Website.Vite, exact pin (Recommended)". Rejected:
`Cloudflare.Worker` with assets; keep wrangler with Alchemy for GitHub only. Reverse: swap the one resource in
`Inventory.stack.ts` for a `Worker` with `assets.directory`.

### 2026-11-19 — infra I2, state store (19)

Question: where is Alchemy's state kept? Answer: "Cloudflare.state() (Recommended)". Rejected: a Postgres database;
local files. Reverse: `alchemy state migrate` to another store.

### 2026-11-19 — infra I3, sign-in tables and secret (20)

Question: who owns the sign-in tables and the sign-in secret? Answer: "Hand migration, minted secret
(Recommended)". Rejected: the secret in 1Password; `@alchemy.run/better-auth` owns both. Reverse: bind the secret
from a reference instead; everyone is signed out once.

### 2026-11-19 — infra I4, previews (21)

Question: where do previews live, and at what address? Answer: "Separate account, workers.dev (Recommended)".
Rejected: the same account on `workers.dev`; the same account on `inventory-pr-N`; no previews. Reverse: point the
preview token at the production account.

### 2026-11-19 — infra I5, model keys (22, and 13 for a deploy)

Question: which stages get a model key? Answer: "Production only, one vendor (Recommended)". Rejected: no key
anywhere at first; production and previews. Reverse: add or remove the key in the stage plan.

The reference `op://BEEP_SECRETS/BEEP_SECRETS/TYPESAFE_AI_API_KEY`: "Not deployed for now (Recommended)". It is
reserved for a later confidence-score goal; no stage gets it, and it is not in `env/op.env`. Rejected: declare it,
unused. It is never resolved by an agent.

### 2026-11-19 — infra I6, email (23)

Question: does the app send email now? Answer: "Not now (Recommended)". Rejected: Resend for reset only; Resend for
reset, verification and invitations. Reverse: a later goal adds the sending domain and its key.

### 2026-11-19 — infra I7, repository rules (24)

Question: are the repository's rules declared as code? Answer: "Yes, with an admin bypass (Recommended)". Rejected:
environments and secrets only; nothing declared. Reverse: remove the ruleset from `GitHub.stack.ts`; it is kept in
GitHub until deleted there.

### 2026-11-19 — infra I8, sign-up

Question: who may make an account on the public address? Answer: "Close sign-up; I add accounts (Recommended)".
Rejected: leave sign-up open; behind Cloudflare Access. Reverse: open sign-up again in the sign-in settings.

### 2026-11-19 — infra I9, Workers plan

Question: which Workers plan? Answer: "Workers Paid, $5 a month (Recommended)". Rejected: Workers Free, measure
first. Reverse: change the plan in Cloudflare; measure a sign-in and a large confirm first.

### 2026-11-19 — the Review warning's headings

Question: keep "Check this before you import" and "Check these N things before you import"? Answer: "Keep them
(Recommended)". Reverse: the two strings in `ReaderWarnings`, `packages/catalog/web/src/ReviewStep.screen.tsx`.

### 2026-11-19 — infra brief

Question: does `BRIEF-infra.md` match? Answer: "The brief matches (Recommended)", with I1 to I9 as answered above.
No goal is open yet: see "order of work after xlsx". Reverse: reopen the brief before the goal's SPEC is ticked.

### 2026-11-19 — order of work after xlsx

Question: in what order do the next three pieces of work go? Answer: "Imports, then infra, then atoms
(Recommended)": the Effect-imports migration is merged to main first; then the goal `infra` is opened and built and
checked on this machine only, stopping before the first step that touches anything outside it, which is Benjamin's;
then atoms. Rejected: infra now in parallel; atoms before infra. Reverse: none needed; nothing is started.

### 2026-11-19 — atoms A1, what stays a hook

Question: where is the line? Answer: "The brief's line (Recommended)": effects banned with no exception; the state
hooks banned; `useRef` for a DOM node, `useId`, `useDeferredValue`, `useTransition` and the atom hooks stay; the
vendored kit is not ours. Rejected: stricter, no `useRef` either; the same line and the vendored kit too. Reverse:
the lint's list of names.

### 2026-11-19 — atoms A2, TanStack Query

Question: does TanStack Query leave the repository? Answer: "Yes, at the end of this goal (Recommended)". Rejected:
it stays under the atoms; it stays for the Items table only. Reverse: none planned.

### 2026-11-19 — atoms A3, order of packages

Question: in what order do the packages move? Answer: "Smallest first (Recommended)": `client`, `access-web`, the
app's shell, `ui`'s own pieces, `catalog-web`, then `review`. Rejected: `review` first. All at once was not offered:
it breaks the app between commits. Reverse: reorder before a package is started.

### 2026-11-19 — atoms A4, the other libraries

Question: do TanStack Table, TanStack Virtual and react-hook-form stay? Answer: "They stay (Recommended)". Rejected:
they leave too. Reverse: a goal of its own, with its own measurements.

### 2026-11-19 — atoms A5, the address

Question: what holds the address? Answer: "An atom over the app's navigate (Recommended)". Rejected:
`Atom.searchParam`. Reverse: move every navigation to `Atom.searchParam` in one change.

### 2026-11-19 — atoms brief

Question: does `BRIEF-atoms.md` match? Answer: "The brief matches (Recommended)", with A1 to A5 as answered above.
The goal is opened after infra is built, by the order "Imports, then infra, then atoms". Reverse: reopen the brief
before the goal's SPEC is ticked.

### 2026-11-19 — the name of effect/Number

Question: beep-effect imports `effect/Number` as `Num` (143 import lines) and as `N` (110) and no rule of its picks
one; which name does it take here? Answer: "Num (Recommended)". Rejected: `N`. `docs/standards/effect-imports.md`
fixes `import * as Num from "effect/Number"` and the check accepts only that. Reverse: the one row for
`effect/Number` in `scripts/check-effect-imports.mjs` and in the standard's table.

### 2026-11-19 — Effect imports in the two vendored UI files

Question: `packages/ui/src/components/data-table/data-table-parsers.ts` and `packages/ui/src/hooks/use-data-table.ts`
are vendored UI that already carried Effect imports written here; migrate them with the rest, or revert them and
leave them out of the check? Answer: "Keep them migrated (Recommended)". Rejected: revert and exclude. Reverse:
restore the two files' import lines and skip `packages/ui/src/components` and `packages/ui/src/hooks` in the check.

### 2026-11-19 — the nested calls the import migration turned into pipes

Question: once each module is imported from its own path, the `missedPipeableOpportunity` diagnostic sees 16 nested
calls it missed through the barrel, and the check fails on them; rewrite them to the equivalent `.pipe(...)` form
(`sam.pipe(actorOf, Effect.flip)` for `Effect.flip(actorOf(sam))`), or revert them and silence the rule at those
sites? Answer: "Accept (Recommended)". Rejected: revert and silence the rule there. Reverse: none needed; the two
forms are the same call sequence.

### 2026-11-19 — merging the import migration

Question: when does the Effect import migration merge into main? Answer: "Merge once the browser pass is clean
(Recommended)". The pass on its last commit, on a fresh database: 200 rows read from `items_messy.csv`, the result
said 155 imported and 45 not, 155 stored; one search, one edit, People, Activity and a take-back that kept the
edited item; no console error. Not seen: the model's suggestions (no key in that copy), the `.xlsx` path, and the
same walk on main before the migration.

### 2026-11-19 — atoms A6, the review's actions as a tagged enum

Benjamin pointed at the `Action` type in `packages/review/src/ReviewDraft.rules.ts` and wrote: "Prime Candidate for
S.TaggedUnion or effect/Data TaggedEnum with Data.taggedEnum constructors".

Question: which form? Answer: "Data.TaggedEnum (Recommended)". `Action` becomes a `Data.taggedEnum` keyed by `_tag`,
with its constructors at every call site and an exhaustive `$match` in `act`, because an action is made in the
browser and never decoded from a boundary. Rejected: `S.TaggedUnion`. Reverse: make it a schema tagged union the day
an action is stored or sent.

Question: how much, and when? Answer: "Whole review state, with the atoms goal (Recommended)". When the review
package moves, last in the atoms goal, `Action`, `Outcome`, `UndoStep` and `RowDecision` are remodelled once:
`Option` for absence (`focus`, `confidence`, a row's decision), no `except?:` optional arrays (an empty default on
the type), and `revert.how` as a named literal domain. Rejected: `Action` only, now; the whole review state now, as
its own goal. Reverse: split it out as a goal of its own before the atoms goal reaches the review package.

A standing preference too: a hand-written `type` or `kind` discriminator in our code is a tagged enum when it lives
only in memory, and a schema tagged union when anything decodes it. The atoms goal's PLAN names every other one
found in the web packages.

### 2026-11-19 — tooling CLI: the package (T1)

Question: what is the repository CLI package called and where does it live? Answer: "@beep/repo-cli, as beep-effect
(Recommended)": `packages/tooling/tool/cli`, bin `beep-cli`, `bun run beep <group> <command>`. Rejected:
`@inventory/repo-cli` in the same folder; `packages/tooling/cli`. Reverse: rename the package and its bin.

### 2026-11-19 — tooling CLI: what runs it (T2)

Question: what runs the CLI? Answer: "bun with @effect/platform-bun (Recommended)", on the condition that it
installs and runs here at 4.1.4 exactly; it does (`BunServices.layer` read a file and spawned git in a probe).
Rejected: bun with `@effect/platform-node`; node. Reverse: the two platform imports in `src/bin.ts`.

### 2026-11-19 — tooling CLI: command groups (T3)

Question: how are the commands grouped? Answer: "beep-effect's groups (Recommended)": `laws`, `quality`, `docs`,
`vendor`. Rejected: one group, `check`. Reverse: move the subcommands in `src/Root.command.ts`.

### 2026-11-19 — tooling CLI: vendoring commands (T4)

Question: where do the vendoring commands live? Answer: "In the CLI (Recommended)": `vendor check` and `vendor
sync`. Rejected: the check in the CLI with the sync left a script; a second package.

### 2026-11-19 — tooling CLI: when the scripts go (T5 and T6)

Question, asked together: when is each old script deleted, and is the Effect imports check ported? Answer: "Each in
its proving commit; imports ported last (Recommended)". Rejected: the same with the imports check left a script; all
deleted at the end in one commit.

### 2026-11-19 — tooling CLI: the calls every package makes (T7)

Question: `quality strict` runs in six packages and `laws exports` in one; how do they reach the CLI without slowing
the loop? Answer: "One entry and a budget (Recommended)": the bin loads the whole CLI and a test fails when a command
that does nothing takes longer than a number set from the first real measurement. Rejected: beep-effect's fast path
from the start; move them to the root. Reverse: add the fast path to `src/bin.ts`.

### 2026-11-19 — tooling CLI: what the tests stand on (T8)

Question: what do the rules' tests stand on? Answer: "@effect/vitest and a real temp folder (Recommended)".
Rejected: vendor `@beep/memfs`.

### 2026-11-19 — the tooling CLI brief

Question: does [BRIEF-tooling-cli.md](BRIEF-tooling-cli.md) match, and when is it built? Answer: "Matches; build now
beside infra (Recommended)". Rejected: build after infra; not yet. The goal is
[goals/tooling-cli](../../goals/tooling-cli/SPEC.md).

### 2026-11-19 — merging the tooling CLI

Question: how does `claude/tooling-cli` reach main? Answer: "Merge locally, I push (Recommended)". Merged into local
main at its last commit of that day.

### 2026-11-19 — tooling CLI: what a rule returns

Question: each rule returns the lines it prints, where the brief asked for typed findings; keep that, or make them
tagged unions? Answer: "Make them tagged unions (Recommended)". Rejected: keep printed lines. Each rule returns typed
findings, a schema tagged union per rule (`docs/standards/schema-first.md`, SF-6), and one renderer prints them; the
printed sentences and exit codes stay byte for byte what they were. Reverse: none wanted.

### 2026-11-19 — tooling CLI: the three deliberate differences from the scripts

Question, as "which do you accept; unticked ones go back": `quality strict` exits 1 on a refusal where the script
printed FAIL and exited 0; `vendor sync` without `--from` exits 1 with the CLI's usage where the script exited 2; and
the new row in `laws boundaries` that lets nothing depend on a `tooling` package. Answer: he ticked all three:
"quality strict fails on a refusal", "vendor sync without --from exits 1", "New rule: nothing depends on tooling".
Nothing goes back.

### 2026-11-19 — the words in the vendored kit

Question: the kit's provenance lines, READMEs and `vendor.json` comments name `scripts/vendor-beep.mjs` and
`scripts/vendor-check.mjs`, which are gone; reword them now, or at the next refresh of the kit? Answer: "Reword now
(Recommended)". Rejected: leave until the next kit refresh. `vendor sync` writes the command names (`bun run beep
vendor sync`, `bun run beep vendor check`) and the kit is synced again at its recorded commit: the first line of the
90 vendored files, the four READMEs and the four `vendor.json` comments change, and nothing else in the kit.
Reverse: the three strings in `packages/tooling/tool/cli/src/commands/Vendor/VendorSync.rules.ts`, and one sync.

### 2026-11-19 — infra, who may sign up on a preview

Question: a preview reads the same `SIGN_UP` list as production; who may sign up on a preview? Answer: "Nobody; test
accounts only (Recommended)": a preview is seeded with the test accounts and sign-up is closed on it; no real email
is stored in the preview account. Rejected: the same list as production; its own list. Reverse: give the preview's
plan a sign-up source again and write the variable to the `preview` environment.

### 2026-11-19 — infra, the test accounts' password

Question: test stages and previews carry the test accounts, whose password is in the public repository, on a public
`workers.dev` address; accept that? Answer: "Password minted per stage (Recommended)": each test or preview stage
gets a generated password for its test accounts, given to whoever deployed it (and the pull request's deploy
output); the repository's known password works only on a developer's own machine. Rejected: accept it; behind
Cloudflare Access. Reverse: stop minting it in the stack; the seeded hash then opens the accounts with the
repository's password again.

As built: the stack mints it for a test stage and shows it in the deploy's output only to a person deploying from
their own machine. A workflow's log in a public repository is public, so a pull request's deploy output never shows
a password; previews are answered next.

### 2026-11-19 — infra, a missing model key

Question: production deploys without a key when none is given, so a mistyped name shows as "answered by rules";
change that? Answer: "Fail the production deploy (Recommended)": a production deploy with no key stops with a
sentence naming the missing reference; a flag deploys without one on purpose. Rejected: deploy and warn; leave as
built. The flag is the variable `DEPLOY_WITHOUT_MODEL_KEY=true`. Reverse: let `modelKeyFor` succeed with no key.

### 2026-11-19 — infra, a preview's password

Question: the repository is public, so workflow logs are too; how does a preview's test-account password reach
whoever reviews it? Answer: "One preview password in 1Password (Recommended)": the GitHub stack writes one password
to the `preview` environment as a secret, from an `op://` reference in `packages/infra/env/op.env`; it is never
printed; previews share it; test stages he deploys by hand stay minted per stage. Rejected: read it from the
stage's state; no previews from the workflow yet. The variable is `PREVIEW_TEST_ACCOUNT_PASSWORD`; its vault path
is his to fill. Reverse: let a preview mint its own again (`testPasswordOf`) and choose how it is read.

### 2026-11-19 — merging infra

Question: how does `claude/infra` reach main? Answer: "Merge locally, I push (Recommended)". Merged into local main
at 8007ab5; the push, and with it `deploy.yml` on `main`, is his.

### 2026-11-19 — atoms, merging the goal

Question: how does the atoms goal reach main? Answer: "Merge each package as it lands (Recommended)". Local main took
the client step at 27d03c1. Rejected: merge once at the end. Reverse: hold later packages on the branch.

### 2026-11-19 — atoms, a refused edit beside another in flight

Measured on `Atom.optimistic` before the client's optimistic write was built: a refused edit stayed on screen until
the last write in flight had answered, where TanStack Query took it back at once. Question: what does the screen do
the moment a save is refused while another is on its way? Answer: "Take it back at once (Recommended)": that field
shows its previous value again beside the error, the other edit's value stays, and the screen ends at the server's
word. Rejected: keep it until the last write answers. Built in `@inventory/client/OptimisticAtoms` (a change list over
the read, not `Atom.optimistic`), with a test of two edits in flight, one refused. Reverse: that one file.

### 2026-11-19 — atoms, a page opened again

TanStack Query kept an unread answer five minutes and showed it while asking again; the first atom reads kept it 30
seconds and then started from the skeleton. Question: what does a return to a page show? Answer: "Old rows at once,
refreshed behind (Recommended)": what was there shows immediately, marked as updating, and the fresh rows are swapped
in; no skeleton on a return. Rejected: 30 seconds then fresh; always fresh. Built in `@inventory/client/Api`
(`keepUnwatched`, five minutes, and `Atom.swr` on every read); the mark is the search box's spinner, "Updating".
Reverse: `keepUnwatched` and the one `Atom.swr` line.

### 2026-11-19 — atoms, the reads after a sign-out or a switch

The brief said a sign-in, a sign-out or a switch of organization is a new atom registry; the build kept every read per
member and organization instead, which needs no second registry. Question: which? Answer: "Keyed reads, and drop them
on sign-out (Recommended)": each read belongs to one member and organization; a switch shows the other organization's
own reads, and switching back within five minutes shows its rows at once; on sign-out the previous person's held rows
leave memory at once. Read as: a sign-out drops everything held; a switch keeps the same person's reads for the
organization they left for the five minutes. Rejected: keyed reads as built (rows linger up to five minutes); a new
registry, as the brief said. Built in `@inventory/client/Api` (`forgetReads`, called when the session answers that
nobody is signed in, and by sign-out and sign-in-as before their reload), with a test. Reverse: `forgetReads` and its
three callers.

### 2026-11-19 — atoms, the table's own store in the review package

The review region held the facets the person ticked as the table's column filters, in an atom of TanStack's own
store (`createAtom` from `@tanstack/store`, imported by the review package's code), kept in step with the region's
derived facets. The brief says "No new state library beside atoms". A second reason came from the review: the review
package pinned the store exactly beside react-table's own range, so a lockfile refresh could leave two copies, and a
ticked facet would stop filtering. Question: may the review package's own code use the table's store? Options:
"Effect atoms only (Recommended)"; "Keep it for this one slice". Answer: "Effect atoms only". I chose; the agent
recommended the same. Built in `packages/review/src/ReviewRegion.atoms.ts`: the ticked facets filter the rows in a
derived Effect atom (`shown`) before the table is given them, and the table keeps only its sort, its search and its
hidden columns. `@tanstack/store` is no dependency of the package any more; it stays a development dependency, with
`@tanstack/table-core`, for the one test that makes a table as the screen's hook does. Reverse: `shown` and the
column definitions' `enableColumnFilter`.

### 2026-11-19 — atoms, a save that changes nothing

A save of decisions answered only the draft's revision. A save that changed nothing (the same one sent again after a
lost answer, a decision taken back while its save was out, rows somebody else had just decided the same way) moved no
revision, so its answer named wherever the draft had got to, and the screen took that for its own next revision: it
then held a picture without the other person's rows under a revision that has them. Question: how does the screen
tell? Options: "Answer says 'no change' (Recommended)"; "Leave it until the domain model"; "Always re-read after a
save". Answer: "Answer says 'no change'". I chose; the agent recommended the same. Built: `PUT
/api/v1/imports/:id/decisions` answers `{ revision, changed }` (`Catalog.contract.ts`; read in one batch on D1,
`ImportStore.adapter.ts`, and in the in-memory twin); the draft's transition (`Draft.machine.ts`) moves its picture on
by the person's own rows only when `changed` is true and the revision is the next one, and otherwise keeps the rows
on screen and asks for the import at once. The property test no longer waives "what is held is what the server held
at that revision" after such a save. Reverse: the field, and the one condition in `SaveAnswered`.

### 2026-11-19 — atoms, a confirm made on a draft somebody else has changed

The confirm sent the decisions the screen showed, all of them, and the server saved them over what it held before it
confirmed: a row another person had decided since this screen last read the import went back to what this screen
showed, and the import was confirmed with totals nobody had looked at. Question: what does Confirm do when the other
person has decided a row this screen has not shown yet? Options: "Refuse, show, confirm again (Recommended)"; "Their
decision stands"; "As today: your screen wins". Answer: "Refuse, show, confirm again". I chose; the agent recommended
the same. Built: `POST /api/v1/imports/:id/commit` takes `ConfirmRequest`, the revision of the draft the screen shows
and the person's own decisions not saved yet (set and clear); on another revision the server writes nothing, not an
item and not a decision, and answers `DraftMoved` (409) with the revision the draft is at. The check is the first
statement of the confirm's own batch on D1 (`insertBatch` in `ImportStore.adapter.ts`: the confirm's row is written
only while the import is open at that revision, and every later statement checks for that row), so two confirms
cannot both pass; the handler checks the same before it works the review out. A confirm moves the draft on by one, so
a confirmed import is never taken for the open one of the same revision. On the screen the confirm is an event of the
draft (`Draft.machine.ts`): it waits for the person's save that is out, goes only on a picture with nothing of
theirs on its way over it, and is held back by any newer picture that arrives meanwhile; refused, the newer picture
is asked for, the review is drawn again from it with its totals, and a line above it says nothing was imported and
how many rows were decided elsewhere, until the person confirms again. Reverse: the `revision` field and the
`DraftMoved` error in the contract, the `revision = expected` condition in `insertBatch`, and `ConfirmPressed` in
the machine.

### 2026-11-20 — atoms, rows that wait unsaved when the page is reloaded

A save that failed left its rows on the screen and in memory only; a reload dropped them, and the browser's kept
copy of the review was thrown away because it differed from the server's. Question: a save failed, rows wait
unsaved, and the person reloads: what becomes of them? Options: "Keep them and send them (Recommended)"; "Warn before
leaving only"; "Drop them and say which". Answer: "Keep them and send them". I chose; the agent recommended the same.
Built: the rows the server has not taken (the save that is out, and what waits behind it) are kept in the browser per
person and import, through `Atom.kvs` like the saved progress (`waitingKept` in `ReviewDraft.atoms.ts`, written after
every event of the draft). When the step is drawn they come back as the person's waiting rows (`Opened { kept }` in
`Draft.machine.ts`), over whatever the server holds, are said as not saved yet above the review, and are sent again
when the import's picture arrives, made on the revision they were made on. The browser asks before the page is left
while rows wait. This replaces the rule that the kept copy is used only while it ends at the server's decisions: the
server's picture is followed, and the waiting rows go over it. Reverse: the `kept` of `Opened`, and `waitingKept`.
Superseded in part (2026-11-20): the rows are kept per person, import and tab by `keepWaiting` and `keptWaiting` in
`Draft.atoms.ts` (`waitingKept` is gone), per "Each tab keeps its own" below; and a waiting row decided otherwise
elsewhere since is held for the person, not sent over it, per "Hold it, show both, ask" below.

### 2026-11-20 — atoms, rows that wait unsaved when somebody else confirms the import

Rows that waited after a failed save outlived a confirm made by somebody else: the result said nothing of them, and
they were sent with the next decision when the import was opened again. Question: rows wait unsaved and someone else
confirms the import: what becomes of them? Options: "Name the rows, then drop them (Recommended)"; "Drop them without
a word". Answer: "Name the rows, then drop them". I chose; the agent recommended the same. Built: the import's status
reaches the machine with every picture (`ViewArrived { open }`); a picture of an import that can no longer be decided
ends the draft, nothing more is sent to it, and the person's rows the confirmed import does not already say are kept
aside (`leftOver`). The result names each, with what the person had decided ("Row 55: you left out"), and they are
kept in the browser only until that screen has been left. A row the server refused while the import was still open
is set aside the same way and let go when the person decides again. Reverse: `closing` in the machine and the alert
on the Result step.

### 2026-11-20 — atoms, an accept that waits while its field's column is matched again

An accept that was unsent or on its way when its field's column was matched again stayed over the match's view and
was sent afterwards, for a proposal the person had not seen; the server takes stored accepts back at a match for
exactly this reason. Question: what happens to that accept? Options: "Server refuses, screen says so (Recommended)";
"Screen drops it only"; "As today". Answer: "Server refuses, screen says so". I chose; the agent recommended the
same. Built, with the revision at Confirm and the no-change answer as one shape: a save names the revision of the
draft its decisions were made on (`madeOn`, one field in) and its answer names the accepts it did not apply
(`notApplied`, one list out); a confirm names the revision it confirms and, for the rows it carries, the same
`madeOn`, and is refused whole with `AcceptsTakenBack` when one of them is such an accept. Each column choice records
the first revision that has it (`MappingChoice.at`), so the server can tell without a history of matches. The screen
takes the accepts out of the rows, draws the review again with their proposals open, and says which were taken back;
a match made on this screen is not announced as a change on another screen. Reverse: `madeOn`, `notApplied`, `at`,
and `withoutStaleDecisions` (which took the place of `withoutStaleAccepts`).

### 2026-11-20 — atoms, a Replace or a Keep-stored across a re-match of the SKU column

A decision to replace a stored item, or keep it, was made against the item the row's SKU found; matching the SKU field
to another column can make the row find another item, or none. Question ("SKU rematch"): what happens to such a
decision made before the re-match? Options: "Server refuses, says so (Recommended)"; "Keep it as made". Answer:
"Server refuses, says so". I chose; the agent recommended the same. The server does not apply it, in the same atomic
batch as the accept rule; the row shows as undecided against what it now reads, and the screen names it as taken
back. Built: `withoutStaleDecisions` (`Rematch.rules.ts`) at the save and the confirm, and the match's own batch dropping
the stored ones (host and twin); a taken-back decision names its kind (`StaleAccept.kind`, `stored`, field `sku`),
and the screen leaves it out of the row and says "the keep-or-replace on row 20 (SKU matched again)". Seen on screen.

### 2026-11-20 — atoms, a kept row that was decided elsewhere since

Rows that wait (after a failed save, or kept across a reload) were sent over whatever anybody decided on those rows
since. Question ("Kept vs newer"): such a row was decided differently since, by somebody else or another tab: what
happens? Options: "Hold it, show both, ask (Recommended)"; "Send it, last press wins"; "Drop hers, name it". Answer:
"Hold it, show both, ask". I chose; the agent recommended the same. The row shows "Decided elsewhere since: <theirs>.
Yours: <yours>" with a choice of which one stands; nothing is sent for that row until the person picks, and the other
waiting rows go as usual. Built: each waiting row keeps the values it is known to have had (`Draft.seen`: what the server was known to hold
when the person began deciding it, then each value sent, any of which a failed save may have written; a value that never
left the browser is not in it). A waiting row is never sent before it is checked against a fresh picture at least as
new as the one held (never the picture a redraw gives again): a picture that holds none of its values puts it on hold
(`Hold.Elsewhere`), said "Row N: decided since by someone else or another tab: <theirs>. Yours: <yours>." with Use
mine and Keep theirs (Keep theirs offered to a view-only member too); the hold's theirs follows later pictures and the
hold lets go when the server holds the person's decision. A
decision of the person's own gone tab beside this tab's is held the same way ("Row N: from your other tab: … This
tab: …", `Hold.OtherTab`), with Use the other tab's and Keep this tab's. Use mine keeps the revision the decision was
made on. Seen on screen (the Elsewhere line).

What such a row does to the confirm is decided in "a held row, a refused row and the confirm" below. Not decided, built
as follows: a press on Import by another member than the one whose unsaved rows the screen shows confirms nothing and
draws the screen again for them; a save answered that the import kept changing waits and is sent again.

### 2026-11-20 — atoms, what a refused save does to waiting rows

A refused save set every waiting row aside, the ones never sent included, and kept none of them. Question ("Refused
save"): what becomes of them? Options: "Keep them, say why (Recommended)"; "Name them once, drop"; "As built". Answer:
"Keep them, say why". I chose; the agent recommended the same. A refusal because the person is not signed in counts as
waiting: the rows are sent after sign-in. A refused row stays kept, marked "not saved" with the reason, until the
person decides it again or dismisses it; rows behind it that were never sent stay waiting. The rule: a decision is on
the server or still waiting, never neither. Built: `SaveSignedOut` waits like a failure; a refusal holds the rows it carried (`Hold.Refused`, kept in the
browser with the waiting rows) and leaves the rows behind waiting, sent once the picture asked for says the import is
open; a closed import's result names the held rows with the rest. Seen on screen.

### 2026-11-20 — atoms, two tabs of one person

Two tabs of one person wrote one kept entry per import: each replaced or erased the other's waiting rows, and a tab that
opened took the other's rows and sent them. Question ("Two tabs"): how are they kept? Options: "Each tab keeps its own
(Recommended)"; "One list, merged by row". Answer: "Each tab keeps its own". I chose; the agent recommended the same.
Each tab keeps and sends only its own waiting rows. A tab opened later takes up rows only from a tab that is gone
(closed or crashed), never from one still open, and no tab writes over or erases another tab's entry. Built: the kept key ends in the tab's id (kept in the tab's own storage, so a reload keeps it); each tab holds a Web
Lock for its life, and a tab that opens an import takes up the entries of tabs whose lock nobody holds (`takeUpGoneTabs`,
`TakenUp`), keeping them under its own key. Seen on screen with two tabs and a closed one.

### 2026-11-20 — atoms, a keep-one-of-two across a re-match of the SKU column

Question ("Twin rematch"): a keep-one-of-two made before the SKU field's column was matched again: what happens?
Options: "Server refuses, says so (Recommended)"; "Keep it as made". Answer: "Server refuses, says so". I chose; the
agent recommended the same. It is not applied; the new pair shows as undecided, and the screen names the keep as taken
back. Built: kind `twin` in the same rule; a row left out stays left out. Not seen on screen (tested on the twin and D1).

### 2026-11-20 — atoms, a Replace or a Keep-stored across a re-match of another column

Question ("Other rematch"): a column other than SKU is matched again: what happens to a Replace or a Keep-stored made
before it? Options: "Refuse if it changes the row (Recommended)"; "Refuse every one"; "Keep it as made". Answer:
"Refuse if it changes the row". I chose; the agent recommended the same. It is taken back only on rows whose comparison
with the stored item changed because of that column; those rows show as undecided and are named on the screen.
Replaces on rows the re-match did not change stand. Built: the column each field read at every revision is kept as moves (`ColumnMove`, `importDraft.movesJson`, migration
0002), and the review runs once with the field on each column to compare the row with the stored item. Not seen on
screen (tested on the twin and D1, two re-matches in a row included).

### 2026-11-20 — atoms, an undone fix across a re-match

Question ("Undone fix"): a fix the person undid, made before its field's column was matched again: what happens?
Options: "Server refuses, says so (Recommended)"; "Keep it as made". Answer: "Server refuses, says so". I chose; the
agent recommended the same. It is not applied to the new value; the row shows the new suggested fix as open, and the
screen names it as taken back. Built: kind `undo` in the same rule. Not seen on screen (tested on the twin and D1). A field moved off its column
because the person took the column for another field is stamped too, so its decisions go stale the same way.

### 2026-11-21 — atoms, a refused row beside a closed tab's decision of the same row

A row of this tab's was refused, and a closed tab of the same person had decided it otherwise. As built, this tab's row
became its own refused line and the closed tab's decision was named once in a toast, then dropped. Question: what
becomes of the two? Options: "Keep both, she picks (Recommended)"; "Name once, then drop". Answer: "Keep both, she
picks". I chose; the agent recommended the same. Both stay on the row's line ("This tab: kept (not saved: the reason).
Your closed tab: left out"), and the person picks one.

### 2026-11-21 — atoms, a field matched by hand to the column it already reads

As built, any pick by hand counted as a re-match, so picking the column a field already read took its accepts and
undone fixes back, and what rests on the SKU. Question: what does such a pick take back? Options: "Only when it
changes (Recommended)"; "Any pick by hand". Answer: "Only when it changes". I chose; the agent recommended the same.
Picking the column a field already reads takes nothing back: accepts, undone fixes, Replace, Keep-stored and
keep-one-of-two alike. A field displaced by another field's match still counts as moved.

### 2026-11-21 — atoms, a tab the browser discarded or has not loaded yet

Such a tab holds no lock, so it counts as gone although it is still in the tab strip. Question: does it count as gone?
Options: "Yes, and it says so (Recommended)"; "Only after a while". Answer: "Yes, and it says so". I chose; the agent
recommended the same. Its rows are taken up, with the hold where someone decided since; when that tab loads again, it
says its waiting decisions were taken up by another tab.

### 2026-11-21 — atoms, a Replace or Keep-stored on an import matched before moves were kept

An import matched before migration 0002 has no record of the column a field read earlier, so whether a re-match changed
how a row compares cannot be known for a Replace or Keep-stored made before it. Question: what becomes of it? Options:
"Take it back, say so (Recommended)"; "Keep it as made". Answer: "Take it back, say so". I chose; the agent
recommended the same. The server takes it back, as it did; the screen names it. The answer is about a decision that
arrives after the re-match.

### 2026-11-22 — atoms, a Replace or Keep-stored already saved on an import matched before moves were kept

Such a decision is saved, and nobody matches that field again. The server cannot tell whether it was made before or
after the old match. Question: what becomes of it? Options: "Leave as made (Recommended)"; "Take them all back once"
(when this ships, every such saved decision taken back once and named). Answer: "Leave as made". I chose; the agent
recommended the same. A confirm does not judge saved decisions, so it is applied as made; the next match of that same
field takes it back and names it, whether or not the row's comparison changed; a match of another field leaves it.
Case: Replace saved on row 2, Unit cost matched before moves were kept, Reorder point matched since: the confirm
overwrites row 2's stored item.

### 2026-11-21 — atoms, a held row, a refused row and the confirm

As built, a row held because it was decided elsewhere since stopped the whole confirm, and a refused row did not (it was
imported without the person's decision and named on the result). Question ("Held row and Confirm"): what does Import do
while a row is held? Options: "Wait until she picks (Recommended)"; "Import, theirs stands". Answer: "Wait until she
picks". I chose; the agent recommended the same. Import does nothing while a row is held; the screen says how many rows
wait for the person and takes them there; one press settles many ("Keep theirs for all", "Use mine for all").
Question ("Refused row and Confirm"): what does Import do while a row is refused ("not saved")? Options: "Wait, like a
held row (Recommended)"; "Import and name it". Answer: "Wait, like a held row". I chose; the agent recommended the same.
Nothing is imported until the person decides the row again or dismisses the line; held and refused rows behave the same.

### 2026-11-21 — atoms, the take-backs of earlier matches and a person who comes later

Question ("Earlier take-backs"): who is shown the line that names what a match took back? Options: "Yes, everyone
(Recommended)"; "Only who was there". Answer: "Yes, everyone". I chose; the agent recommended the same. The line is
shown to everyone working on the import, newcomers included, until each dismisses it.

### 2026-11-20 — no `switch`, the vendored components included

Every `switch` in the repository was to be replaced, in this order of preference: a struct union becomes an
`S.TaggedUnion` (or `S.toTaggedUnion`, or a `Data.TaggedEnum`) and is read with its `match`; a literal union becomes a
`LiteralKit` and is read with its `match` or `matchOrElse`; anything else is read with `effect/Match`. Thirty-three
were in our own code and fourteen in the vendored components (`packages/ui/src/components`: file-upload, data-table,
data-grid), which this repository otherwise keeps as published. Question: convert those fourteen too? Answer: "Convert
all 14"; the agent recommended leaving them. Read as: the vendored components may be changed for this rule, each change
marked "Local change" where it is made; a later `shadcn add` of one of those files is compared by hand. Rejected:
leaving them as published; converting only the data table. Built with `@beep/schema` added to `@inventory/ui`. Reverse:
the "Local change" blocks in those eleven files.

### 2026-11-22 — no `try` statement, repository wide

"I noticed some try catch blocks in the source code on main: packages/client/src/Tab.atoms.ts L26-30. In beep-effect
I've banned try/catch blocks as my preference is either using Effect(s) or effect/Result for code which can fail with
errors. I want this enforced repo wide." Three questions followed.

The vendored kit has fourteen `try` blocks (`packages/ui/src/components` and `hooks`). Question: convert them too?
Options: "Convert them too (Recommended)"; "Leave vendored as published". Answer: "Convert them too". I chose; the
agent recommended the same. Each becomes `Result.try` or `Option.liftThrowable`, marked "Local change".

Plain JavaScript: the telemetry start script, and `apps/inventory/public/theme-init.js`, which runs before the app
loads and cannot import Effect without loading the library before first paint. Options: "Script yes, theme-init named
(Recommended)"; "No exception at all". Answer: "Script yes, theme-init named". I chose; the agent recommended the
same. The telemetry script is converted; `theme-init.js` is the one file the law names as allowed, with the reason
beside it. `.agents/` is left out by name, as for the deprecated-API check.

When? Options: "Next atoms batch (Recommended)"; "After Wednesday"; "Now, ahead of the fixes". Answer: "Next atoms
batch". I chose; the agent recommended the same. Not built yet.
