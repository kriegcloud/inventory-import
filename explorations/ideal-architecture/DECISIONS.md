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
| 13 | A second vendor for confidence scores? | Not until a labelled calibration run shows a gain (at odds with "ai-typesafe confidence" on his list of wanted items; see "core, reversed"; asked again as decisions 45 to 47 of the alchemy-domain brief) | 03 §7.3 |
| 15 | Do model-preselected values count as Ready? | No | 03 §7.8 |
| 16 | MCP for agents? | Own tools: reads plus proposal-only writes that need approval (asked again as decisions 50 and 51 of the alchemy-domain brief) | 01 §3 |

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

### 2026-11-18 — core (reversed 2026-11-19 by "core, reversed")

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

Question: the button is shown for an unmatched column only while some field still has no column, a narrowing made
without asking him; keep it? Answer: "Keep the narrowing (Recommended)". It is now Benjamin's choice. Rejected: "Show it for
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

Question: who builds `@beep/xlsx`? Answer: "The same session (Recommended)", the one that wrote the brief, on a branch
of its own. Rejected: a fresh session. Reverse: hand the branch and `goals/beep-xlsx/PLAN.md` to
another builder.

### 2026-11-19 — xlsx merge

Question: how does the xlsx work reach main? Answer: "Merge locally, I push (Recommended)"; merged into local
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
[BRIEF-atoms.md](BRIEF-atoms.md); nothing was built then; the goal is now merged into main.
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

The 1Password reference for `TYPESAFE_AI_API_KEY`: "Not deployed for now (Recommended)". It is
reserved for a later confidence-score goal; no stage gets it, and it is not in `env/op.env`. Rejected: declare it,
unused. It is never resolved by an agent.

At odds with "ai-typesafe confidence" on his list of wanted items (see "core, reversed"). Whether the key is used
is decision 46 of the alchemy-domain brief; this entry stands until he answers it.

### 2026-11-19 — infra I6, email (23) (at odds with "Resend email" on his list of wanted items; see "core, reversed")

Question: does the app send email now? Answer: "Not now (Recommended)". Rejected: Resend for reset only; Resend for
reset, verification and invitations. Reverse: a later goal adds the sending domain and its key.

### 2026-11-19 — infra I7, repository rules (24)

Question: are the repository's rules declared as code? Answer: "Yes, with an admin bypass (Recommended)". Rejected:
environments and secrets only; nothing declared. Reverse: remove the ruleset from `GitHub.stack.ts`; it is kept in
GitHub until deleted there.

### 2026-11-19 — infra I8, sign-up

Question: who may make an account on the public address? Answer: "Close sign-up; I add accounts (Recommended)".
Rejected: leave sign-up open; behind Cloudflare Access. Reverse: open sign-up again in the sign-in settings.

### 2026-11-25 — staging, invited sign-up

Question: may a person I name make a real account on staging, so someone outside can try the app with their own
login? Mine: "Real account for him". Staging now reads `SIGN_UP` at deploy from a secret on the `staging`
environment (a secret, I chose, so the public logs never print the email); unset or empty, sign-up stays closed.
This narrows I8 for staging only: an email I name may be stored there. Known: staging shares the previews' Cloudflare token (2026-11-22, "Keep sharing, say so"), so anyone
who can push a branch here can reach that person's account on staging; today only I can push. Rejected: share a
test account's login. Reverse: delete the secret, deploy staging again, and delete the invited account.

### 2026-11-25 — production's sign-up list is a secret

Question: production read its sign-up list from a GitHub variable, which the public deploy log prints. Mine: keep
the emails out of the log, as on staging. The production job now reads the `production` environment's secret
`SIGN_UP`; unset, sign-up is closed. The variable the repository's stack writes stays, for the setup command, and no
deploy reads it. Reverse: point the job at `vars.SIGN_UP` again.

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

How the budget is measured changed on 2026-11-22 (not asked): the rule and the one entry stand. The test held
the time on the clock to 400 ms, and GitHub's four-core runner, busy with the rest of the check, took over five
seconds for five starts, so CI failed on a CLI that had not changed. It now holds the processor time the start used
(user and system, as bash's `time` reports them) to 700 ms: the same 3.6 times the measured start (110 ms on the
clock, about 185 ms of processor time, since bun runs several threads). Shown both ways: with the CLI held to 8% of a
core the old test timed out and the new one passes; with four heavy packages imported by the entry the new one fails
(1,073 ms). What loading everything costs today: 121 ms on the clock for `--version`, of which bun alone is 18 ms and
Effect's CLI with no command of ours 95 ms, so a fast path would save about 26 ms. Not built.

### 2026-11-19 — tooling CLI: what the tests stand on (T8)

Question: what do the rules' tests stand on? Answer: "@effect/vitest and a real temp folder (Recommended)".
Rejected: vendor `@beep/memfs`.

### 2026-11-19 — the tooling CLI brief

Question: does [BRIEF-tooling-cli.md](BRIEF-tooling-cli.md) match, and when is it built? Answer: "Matches; build now
beside infra (Recommended)". Rejected: build after infra; not yet. The goal is
[goals/tooling-cli](../../goals/tooling-cli/SPEC.md).

### 2026-11-19 — merging the tooling CLI

Question: how does the tooling CLI reach main? Answer: "Merge locally, I push (Recommended)". Merged into local
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

Question: how does the infra work reach main? Answer: "Merge locally, I push (Recommended)". Merged into local main
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

### 2026-11-19 — core, reversed

Benjamin reversed the 2026-11-18 decision "core" (the model-first shape over D1 state tables, with Alchemy's domain
ideas borrowed and the import lifecycle moved onto an aggregate "later"). His words: "not seeing a lot of
@alchemy.run/domain"; "If I made that decision I clearly wasn't paying attention. @alchemy.run/domain was one of the
primary reasons I wanted to embark on this build out in the first place"; "Not borrow use."; and "if possible find a
way to make use of ever single thing". The app is where he explores the library in full and settles its designs
before porting beep-effect to it.

Question: does the app use `@alchemy.run/domain`, or take its ideas? Answer: it uses it, all of it. How is not
decided: the reading, the trials and the brief are their own packet, [alchemy-domain](../alchemy-domain/README.md),
and its [brief](../alchemy-domain/BRIEF.md) puts each "how" to him. None of that brief's recommendations is his
until he answers it. Decision 1's pin is on main (as of 2026-11-22), and the review's model of its move 1 is built on
that pin and merged into main (`0c4c5e5`); the rest of it is built after he signs it
(the atoms goal, the other condition, is merged).

From his own list of 2026-11-18, the items he marked as wanted (CAPTURE.md of that packet records them under
2026-11-19, in his labels): "Cluster, workflows, singletons"; "Drizzle v1 on Durable Objects"; "GraphQL
(effect/graphql)"; "ai-typesafe confidence"; "Resend email"; "Discord sign-in, distilled clients"; "Alchemy Git". He
did not mark R2 presigned uploads, which stay out.

What this touches in this file:

- "core" (2026-11-18): reversed, in his words above.
- "infra I6, email (23)" (his "Not now" of 2026-11-19), open question 13, and the second paragraph of "infra I5"
  (the key reserved for confidence scores): not reversed in any words of his. Each is at odds with an item he marked
  as wanted. That they are reversed is inferred from his list and from "make use of ever single thing"; the
  alchemy-domain brief asks him (its decisions 45 to 49), and these entries stand until he answers.
- "infra I7, repository rules (24)" was answered "Yes, with an admin bypass" and is built; it stands. The
  alchemy-domain brief proposes Alchemy Git beside it (its decision 55), not in place of the ruleset or of CI.
- The rows of the README's table "Where the research disagrees with the request" that name those items say so.

Rejected: keeping "core" and moving one aggregate later. Reverse: a new decision by him; the app as it stands on main
is the D1 core, and nothing of the reversal is on main yet but the library's pin and the review's model of move 1
(as of 2026-11-22; `0c4c5e5`).

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

### 2026-11-21 — deprecated APIs

He asked, in his words: "In beep-effect we have this lint rule or something that errors when deprecated api's are
used. Can you […] configure and set this up for us?" Built as beep-effect has it, oxlint's
`typescript/no-deprecated`, as a law and a root task, `deprecated:check` (`docs/standards/deprecated-apis.md`), on
every code file git would commit but the vendored skills under `.agents/` (decided below, 2026-11-22). Reverse: drop
the task from `check` and `check:full`.

### 2026-11-21 — deprecated APIs, the vendored data grid's `document.execCommand`

The check found `document.execCommand("insertText", …)` in the vendored data grid, which names no replacement.
Question: what should happen to it? Options: "Local change (Recommended)"; "Exempt vendored kit"; also named, deleting
the grid, which no screen uses. Answer: "Local change"; the agent recommended the same. His answer covers the option as
it was put to him: the fallbacks already in the file, at the cost of the browser's own undo in a cell's editor.

What was built first was a different design, not put to him before it was built: measured in Chromium, the number
cell's fallback stored 6 for a typed 56 and 5 for a typed -5, so the browser was made to type the key that opens an
editor, through a prop on the vendored cell and a `flushSync` in its key handler. That was found wrong for a
column with a variant and its own `cell`, which lost the opening key and stored 6 for a typed 56.

### 2026-11-22 — deprecated APIs, `.agents/` is not read

Question, by dialog: the check reads every code file except `.agents/`, the vendored agent skills; reading it gives 5
findings in one skill's browser-probe script, which reads two deprecated CSS properties on purpose, plus 18 files with
no TypeScript project; he had asked for no exemptions. Options: "Leave it out, by name (Recommended)"; "Read it and fix
it", a local change to the probe script and a project for the 18 files. Answer: "Leave it out, by name". I chose; the
agent recommended the same. It stays the one folder named as not read, said in the check's output and in its doc
(`leftOut` in the law). Of its 18 code files, 16 are other people's skills and two (the ontology auditor's script and
its test) are from his own beep-effect; all are copied as published and run by no part of the app or its checks. Reverse: empty `leftOut`, give the 18 files a project and change the probe script.

### 2026-11-22 — the vendored data grid's typing, for every column

Question, by dialog, after he was told that the fallbacks store wrong numbers, that typing in place had been built
without asking, and that it still lost the first key in a column with its own `cell`: what should happen to the grid?
Options: "Fix it for every column (Recommended)", keeping the built approach and extending it to those columns, with a
browser test that types 56, -5 and a space into each editor and reads what is stored; "Remove the grid"; "Exempt the
grid". Answer: "Fix it for every column". I chose; the agent recommended the same.

Built: the cell's wrapper reads from its column whether the editor that will open takes typing, so a column with its
own `cell` behaves as a plain one; it opens and focuses that editor before the key handler ends, and the browser types
the key. No fallback that puts text in is left. Where the editor has not taken the focus by then (a screen that keeps
the editing state itself and applies it later), the key is prevented and the editing ended: the key does nothing, and
nothing is stored that was not typed. A column that writes its own cell (`meta.writeCell`) is left as published.

"Every column" as built means the four editors that take typing: text, number, url and long text, in a plain column
and in one with its own `cell`. The select, multi-select, date and file editors and the boolean's checkbox are as
published and untouched; the published select and multi-select drop the key that opens them, and still do (not asked
whether he meant those too).

The test is `bun run grid:keys` in `apps/inventory`, on a development-only page (`/gallery/grid`) that adds nothing to
the production build (its stylesheet is 124,636 bytes with and without the page; the walk that lists the
stylesheet's sources is told not to follow it). On each of the four editors, in both kinds of column, with no pause
between keys and with 40 ms, it types 56, -5 and a space, types then presses Escape, types then undoes, and presses F2
then types: 96 cases, read from what the grid stored. It fails on an error or a warning in the page's console, starts
this checkout's own server on a port it asked the system for, and fails when no browser is found. On the grid as it
was before the fix for every column, 22 of the 96 fail. Chromium only. Not measured: Firefox, Safari, a touch
keyboard, an input method, a production build of the grid.

Where the test runs (not asked; he has been told): CI runs it as a step after the full check, with the
runner's Chrome (`/usr/bin/google-chrome`, which GitHub's Ubuntu 24.04 image documents), and it is run by hand after a
change to the grid. The step has not run on a runner yet: nothing is pushed. It is not part of `bun run check`. An
earlier version of this entry said the machine that runs the checks has no browser; that was wrong.

Not decided, and pinned by the test as "as published", not as rules:

- A space typed on a focused cell replaces a text cell's value with one no-break space (U+00A0, the browser's way with
  a lone space in an editable element) and empties a number or url cell. The published grid does the same, measured
  with its own mechanism (`document.execCommand("insertText", false, " ")` on a selected value in Chromium).
- Escape in the long-text editor keeps what was typed: its popover closes and saves. The published grid does the
  same, measured on the grid as it was before any of these changes.

Also seen, and not held by the test: the published long-text editor typed the opening key on the next frame, and in
one run of the published grid with no pause between keys it stored a wrong value in one of its long-text cases. The
browser types that key now, and no such run has failed since; the test does not fail on the old code every time.

Reverse: the "Local change" marks in `packages/ui/src/components/data-grid/` (`data-grid-cell.tsx`,
`data-grid-cell-variants.tsx`, `data-grid-utils.ts`), one at every changed or removed line.

### 2026-11-22 — deprecated APIs, the scripts' and the page script's projects (not asked)

The check refuses a code file no tsconfig includes, so the app's development scripts (`apps/inventory/scripts`, plain
JavaScript) and the one script the page loads (`public/theme-init.js`) each got a project, type-checked by the app's
`check`. Both are looser than the repository's one profile: no Effect rule applies (`plugins` is empty; 78 findings in
the scripts otherwise), and the scripts' project has `noImplicitAny` off, so an untyped parameter or a package that
ships no types is `any` without an error and a deprecated call behind either is not seen. Before, nothing
type-checked them at all. This is not a decision of his; he was told on 2026-11-22 and it was
left as built. Other ways: the Effect rules on and the findings fixed; the scripts rewritten as TypeScript;
`noImplicitAny` on alone. Reverse: remove `plugins` and `noImplicitAny` from `apps/inventory/scripts/tsconfig.json`
and `plugins` from `apps/inventory/tsconfig.public.json`, and fix what the check then finds.

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
batch". I chose; the agent recommended the same. Built: every `try` is converted but theme-init's, and
`bun run check` refuses one in any code file git would commit, its doc comments' examples included, outside `.agents/`
and the scratchpad (`try:check`, `docs/standards/no-try.md`).

### 2026-11-22 — Alchemy, which build, and the state store it upgrades

The Alchemy packages are a build of the library's `main` (`vendor/alchemy`, commit `734c27a`), because
`@alchemy.run/domain`'s `Decision` and `Verify` are in no release. The update to that build was held on one thing:
it raises the Cloudflare state store's version from 8 to 9. The first thing on it that reaches a store an older build
made upgrades that store, one way: `alchemy state bootstrap` and CI's deploys (`deploy.yml` passes `--yes`) without
asking, a deploy from the workstation only after a confirm. A checkout on an older build is refused by the store from
then on.

"All I know is I want the latest version of alchemy. We will likely need to update effect & alchemy again before
Wednesday comes." And on what is deployed: "We can always tear down & redeploy from scratch. The idea is that we get
our ideal version built. I don't care about anything we've deployed yet we can start from scratch so that we have the
best names & things."

So the pin follows the library's `main`, the upgrade of the store is accepted, and nothing deployed so far is kept
for its own sake. Only this repository's stacks keep their state in `Cloudflare.state()`; beep-effect's use
`AWS.state(...)` and are not touched. Reverse: none for the store, the upgrade is one way; destroy the stages and
deploy them again from an empty store.

### 2026-11-22 — Alchemy, where the pinned build is kept and how often it moves

A build of `main` is deleted from the library's registry a week after `main` moves on, so the build must be kept
somewhere this repository controls: seventeen files, 38.7 MB. Options: the files in the repository, moved only when
needed; the files as release assets on GitHub; in the repository, moved often. Answer: "In the repo, re-pin only when
needed". Rejected: release files on GitHub; re-pin often. One move is expected before Wednesday 2026-11-25, so a
move is one command, `bun run alchemy:repin -- <commit>` (`vendor/alchemy/README.md`). Reverse: delete
`vendor/alchemy` and the root `overrides`, and ask for a release once one contains `Decision`.

### 2026-11-22 — the review's model, its names (not asked for each)

Asked what the model's units should be called, he gave no names and said the names need not last yet: "I don't care
about anything we've deployed yet we can start from scratch so that we have the best names & things." The names are
proposed, not his, open to change until the first hosted deploy he keeps stores an event under them: the aggregates `Import`,
`Row` and `Group`, in the model `Catalog`, served as `CatalogApi`. Reverse: rename before that deploy at no cost; after
it, the events already stored carry the old names, and a rename needs an answer for them.

### 2026-11-22 — the review's model, what is shown on Wednesday

Two models of the review exist: one unit for each group act, which he chose, and one unit for each row, built first
and set aside. Question: which is shown on 2026-11-25? Answer: "Chosen design, parked one as fallback". The one-unit
model is built for `main`. If it is not checked and merged by the evening of 2026-11-24, he shows Verify on the
per-row model from a local branch on his own machine, and says plainly that it is the alternative he did not choose.
That branch is kept running on the pinned build and gets nothing else. Reverse: none needed; the fallback is deleted
once the chosen model is in `main`.

### 2026-11-22 — the review's model, a rule that each command can happen

The model's rules say what never happens; a change that made the model refuse every command would keep them all.
Question: should Verify itself hold that each command can be taken, beside the stories? Options: "Yes, one per
command"; "Stories only". Answer: "Yes, one per command". Rejected: "Stories only". It was put to him as a search,
not a proof, and as not yet tried on this model. Each command gets a `sometimes` rule on the model (a row can be
decided, an import can be confirmed, an act can be undone), so a command nothing reaches shows as "never reached" in
Verify's own report. The stories stay as tests.

What it is, tried on the pinned build with the per-row model, not yet with the model he chose: the rule is given the
whole model (every instance, with the events it recorded) and is searched from a model with nothing in it. "Reached"
means one sequence of commands was found that gets there, printed and run on the real code; it says nothing of any
other sequence. "Never reached" fails the verification, and can also mean only that the search was too short. Verify
searches two commands deep unless told otherwise: there, with eleven of the twelve commands and no longer walks, four
were not reached (a take-back, a reopening, a group's row skipped and a group stopped each take three commands), and
with its 200 longer walks three, since a walk happened on the take-back. At three deep all were reached, and all
twelve on the whole model, so the search is set to three. One way it does not fail: a search that stops at its
budget with `allow: { truncated: true }` says nothing of the rules it did not reach, so that option is never set.
Verify also says, with no rule written, when no state the invariants allow lets a command record an event; the rule
adds that some sequence from nothing gets there. Reverse: delete the `sometimes` block of the model.

### 2026-11-22 — the review's model, what keeps a rule from being taken out or weakened

Question: what holds the rules, so that none is taken out or made to say less without it showing: the list of rule
names written by hand in the tests, or the file the library's Verify keeps? Options: "The library's lock file";
"Both"; "Keep the hand-written list". Answer: "The library's lock file". Rejected: "Both"; "Keep the hand-written
list". The hand-written list was to go once the lock had been shown to refuse a rule that slipped.

The answer came with the lock described as a file that keeps how each rule stands. It does not: on the pinned build
(`lock: "./<Model>.lock.json"` on `Verify.report`) it is one file beside the test that keeps each rule's kind and
its text. If that description is what he chose from, his answer rests on something that was wrong on that point; so
the hand-written list, which does say how each rule stands, stays until he has answered what holds that.

What the lock does, shown on the per-row model: an invariant made to say less ("says less than the rule locked",
with the state that now passes), a rule taken out, a rule renamed, and a transition and a decision's rule whose text
changed are each refused by name. It compares a rule's own text: only an aggregate's invariant is compared for what
it says, any other rule whose text changed is refused whatever the change, and a rule made to allow more through a
helper or a constant it calls passes, as does an invariant whose difference another invariant still covers. Under
`CI` the file is never written, a rule it does not list fails, and `UPDATE_VERIFY_LOCK=1` is ignored; everything is
proved and searched again first, the lock skips nothing. Outside CI a new rule is added to the file without a word,
and `UPDATE_VERIFY_LOCK=1` locks every rule as it is written and passes, so that variable is never set to make a
test pass.

Not held by the lock, and not yet answered: whether a rule is still proved or has slipped to only searched. Verify's
`require: { proved: [...] }`, one assertion that every rule but the few named as searched is proved, or the
hand-written list as it is, each holds that. Reverse: delete the `lock` option and the file.

### 2026-11-22 — the review's model, where its proofs run in CI

Locally the proofs are part of `bun run check` and the search of the whole model part of `bun run check:full`.
Question: where do they run in CI? Options: "Own job + nightly, no new infrastructure"; "Also replay from your
remote cache"; "Full copy of beep-effect's tiers". Answer: "Own job + nightly, no new infrastructure". Rejected: the
other two. The proofs and the search are each their own turbo task, whose inputs name what a result depends on: the
model's files and the kernel files they import, the pinned library, the versions `bun.lock` resolves for the
package (Effect, the solver, the parser), the file Verify locks the rules in, and the two variables Verify reads.
CI's main job stops running them; a second job runs them, restoring turbo's results from the last run on `main`
through GitHub's own cache and saving them only on `main`, so it proves nothing unless one of those changed. A
nightly workflow runs everything with nothing replayed and opens or comments on one labelled issue when it fails;
GitHub turns a schedule off after 60 days without a commit on a public repository, and turning it on again is done
by hand. No secret, no remote cache. Not built yet: it goes in with the model. Reverse: put `prove` and the search
back in the main job's command and delete the second job and the nightly workflow.

### 2026-11-22 — the check on GitHub's runner

CI failed twice on code that had not changed: the CLI's start-up test, then two property tests of `@beep/xlsx`, each
"timed out in 5000ms". Reproduced with the whole check pinned to four cores (`taskset`): turbo starts ten tasks at
once and each test run a worker per core, so tests ran several times slower than they are, and a different one hit
its limit each time (the xlsx property, the review's parity test, a slow test's 10 s hook). What was changed, none
of it a test's own number or what a test asserts:

- CI runs two tasks at a time with one test worker each, and `--continue`, so a red run lists every failure.
- One file, `vitest.shared.ts`, holds every test's limit (30 s, hooks 60 s, slow tests 120 s) in place of vitest's 5 s
  and 10 s. Sized from the slowest tests on two pinned cores: 4.4 s and 31 s.
- In the four places whose tests wait in real time (`packages/client`, `packages/catalog/web`, `packages/review` and
  the app's fast tests), a test that fails is tried again, three times at most and half a second apart; a property
  that was falsified, and a test or hook that ran out of time, never are. This one is his decision, below.
- No property test's run count was lowered and nothing is skipped.

Measured, cold, pinned (`taskset`), the whole check each time, 80 tasks:

| Cores | Tasks at once | Test workers | Second try | Runs | Green | Seconds |
| --- | --- | --- | --- | --- | --- | --- |
| 4 | 10 (as before) | one per core | no | 1 | 0 | 117 |
| 4 | 2 | 2 | no | 3 | 1 | 106 to 118 |
| 2 | 2 | 2 | no | 3 | 2 | 144 to 236 |
| 4 | 2 | 2 | twice | 6 | 5 | 102 to 145 |
| 2 | 2 | 2 | twice | 3 | 3 | 152 to 160 |
| 4 | 2 | 1 | three times, 0.5 s apart | 3 | 3 | 168 to 192 |
| 2 | 2 | 1 | three times, 0.5 s apart | 1 | 1 | 342 |

The last two rows are what CI runs. Every red run after the first row was a test that waits in real time, never a
limit. One test worker costs about a minute on four cores.

Measured again on the tree with everything merged (main at 46eed3e with the loud retries and the sized limits, 85
tasks; the table above had 80 and lacked the atoms and sync branches), cold, as CI runs it: four pinned cores, green
three times in a row in 235, 208 and 276 s; two pinned cores, green in 298 s. No test needed a second try in any of
them. The slowest, five minutes, leaves about ten of the job's 15 for the install, the browser step and a runner
slower than two pinned cores here. The runner itself has not run this yet: nothing is pushed.

The concurrency, workers and limits were not put to me; the second try was. Question, by dialog:
the tests that wait in real time fail now and then under load and are tried again with no word, which can hide an
intermittent fault in the review's save and confirm, and it is not a cure; what should happen to the retry? Options:
"Retry for now, said aloud; remove after TestClock" (Recommended), "Remove it now", "Keep it as is". Answer: "Retry
for now, said aloud; remove after TestClock". I chose; the agent recommended the same. Built as: a reporter
(`vitest.retries.ts`) names every test that passed on a later try, with its file, line and which try, in the run's
output and as a GitHub warning on that line, and counts them at the end of each run; a test or hook that ran out of
time is never tried again, so a hang cannot eat the job four times over. The retry is removed in the same change that
moves the last of the 28 files onto `TestClock` (the atoms work). Rejected besides: a longer limit for the xlsx tests
alone (the next heavy test would be next); a second try for every package (only these four wait in real time);
trying a falsified property again. Reverse: the three lines in `.github/workflows/ci.yml`, `limits` in each
`vitest.config.ts`, and `realTime` and `saidAloud` in the four that wait in real time.

A limit above the shared one is set only with what was measured written beside it: the 2,000-run waited-rows property
(180 s; 24 s alone on two pinned cores), the draft machine's four properties and its three seeded ones (120 s; 13 s
the slowest seen), Steps' heaviest shapes (60 s; 9.7 s), the scratchpad's nested run (120 s) and the CLI's start-up
(300 s: five starts, the slowest seen 19 s on the clock; no start is stopped by the clock, since 2026-11-22). Limits
set below the shared one were taken out, so the shared one applies: six test files had 10 s
or 20 s, the 50,000-row slow tests 60 s. The vendored kit and the scratchpad use the shared limits too; vendor sync
writes them into the kit's configs.

Two things this does not end, both found while measuring:

- The tests that wait in real time (28 files) still fail now and then under load on any machine, and only the second
  try keeps that out of sight.
- One property test of the review's draft found a real counterexample: "with the person confirming: a confirm the
  server makes writes what its screen showed, and nothing is sent beside it" is falsified by seed 369148268449177
  after 651 runs ("after everything landed, a row of the person's still waits"), every time, on an idle machine too.
  A second seed, -2416120108841983, falsified it after 762 runs in an unpinned run of the full check. Seeds are drawn
  at random and it was met twice in about twenty runs here, so CI will meet it. Since: on the draft machine of one
  model (`518babd`) neither seed falsifies it; the first seed's shortest ordering and both seeds are named tests in
  `packages/catalog/web/test/Draft.machine.test.ts`, with a third seed of another property, which the property world
  had wrongly failed.

### 2026-11-22 — dependencies, versions and derived configuration kept in step

I asked "do we have a `deps:update` script like beep-effect?" (there was none: only `deps:lint` and `deps:outdated`,
and syncpack read 7 of the 25 `package.json` files), and then: "Actually I would like a version-sync & config-sync
command as well that keeps hard coded values & configs up to date & in sync along with the update:deps". Built as
three commands of the repository's CLI, in beep-effect's shapes and without its packages: `deps update`,
`version-sync` (check, `--write`, `--dry-run`) and `config-sync` (writes; `--check`, `--dry-run`). `version-sync`
and `config-sync --check` are part of `bun run check`. What each covers and leaves alone is in
`docs/sync-commands.md`. `version-sync --write` may change a version number in `CLAUDE.md`, and nothing else there.

These were not put to me. Each is small to reverse:

- **The held list is `updateGroups` in `.syncpackrc.json`**, a group's `label` being its reason, where beep-effect
  keeps a ledger of holds with a probe for each. One list, read by syncpack (`deps:outdated`) and by `deps update`.
  Rejected: a ledger with probes (a goal of its own); a second file beside syncpack's. Reverse: move the groups.
- **What is held**: `@effect/tsgo` and the four tools it patches (`typescript`, `tsrs`, `oxlint`,
  `oxlint-tsgolint`); `alchemy`, `@alchemy.run/*` and `@distilled.cloud/*`, pinned as one set to one commit;
  `better-auth`, whose tables are a migration written by hand; `xlsx`, which is an address. Not held, and it would
  move: `@types/node`, from ^24 to ^26, while the workflows run Node 22. Reverse: one group each.
- **`deps update` asks the registry itself** (`bun info <name> version`) and does not call `syncpack update`, so its
  plan is tested with no network, and `effect` and the `@effect/*` packages released with it move to one version or
  not at all. Rejected: reading what syncpack prints.
- **Records are never rewritten**: `explorations/`, `goals/`, the root's `DECISIONS.md`, `docs/qa`. The
  standing documents are `CLAUDE.md`, `AGENTS.md`, `README.md`, `docs/` and `.claude/agents`.
- **A sentence that records a check is moved with the rest** ("checked in effect's source at this version"): the
  command prints each line it changes, and a person re-checks or rewords. Rejected: guessing which sentences are
  records.
- **Three places were wrong and are written**: syncpack's sources (now one pattern for each workspace pattern), the
  app's `wrangler.jsonc` `$schema` (it named a file that does not exist from that folder), and `tsconfig.base.json`'s
  `$schema` (the library's repository instead of the installed `@effect/tsgo`).
- **No package gets project references.** Each is type-checked from source by `tsrs -p`; references would need
  `composite` and a build order, which is a change to how the repository type-checks. `config-sync` keeps the
  solution files (the app's, and the root's when there is one) and holds a project's references to its declared
  packages only where a project already has them.

Not decided, and mine: **one catalog at the root** (versions written once, each package saying `catalog:`). The
commands already read a root `catalog` first, and a test holds that. It would take: a top-level `"catalog"` in the
root's `package.json` (not `workspaces.catalog`: every rule reads `workspaces` as a list); `catalog:` in the 24
workspace `package.json` files; a new `bun.lock`; `customTypes.catalog` and a version group in `.syncpackrc.json`,
as beep-effect has; and `vendor sync` writing `catalog:` into a vendored package. One commit touching all 25 files,
for a day when no other branch is open.

### 2026-11-22 — the scratchpad

I asked: "So beep-effect has this `scratchpad` folder modeled after effects. It has grown a little out of hand
overtime but I'd like a similar thing in this repository. Could you look at how effect does it? Id like to be able to
import any package from the repo into it as well has have a structured way for us to write tests when I want to try
experiments or explore ideas I have in a non destructive & isolated way." What was found: Effect's `scratchpad/` is a
private workspace package that depends on every package, three files committed and everything else ignored, no tests
and no structure; beep-effect's holds 1,126 tracked files and 135 MB, whole projects with their own lockfile, read by
the main build, and nothing in it ever ends. Built as `scratchpad/`, the `scratch:*` commands and
`docs/scratchpad.md`. Eight questions, answered by dialog, and the whole confirmed with "Yes, build it". For each: I
chose; the agent recommended the same.

1. **Kept or thrown away?** Answer: "Committed, one folder each". Rejected: "Ignored, like Effect"; "Ignored by
   default, kept on request". An experiment is `scratchpad/experiments/<name>/`, in git.
2. **In the check?** Answer: "Its own commands only". `scratch:check` and `scratch:test` type-check and test it on
   request; `bun run check`, the build and CI never read it; the one thing `bun run check` enforces is that nothing
   outside the scratchpad imports from it. Rejected: "Type-checked in check"; "Fully in check and CI".
3. **Rules inside?** Answer: "Types on, bans at graduation". The type-checker with the Effect diagnostics runs in
   `scratch:check`; the laws on how code is written and my bans (no try/catch, no switch, the import form, tags) are
   not enforced inside it and apply when code graduates into a package; secrets and private names are still refused,
   since the repository is public. Rejected: "Your bans always"; "Everything applies". This gives the laws on tags,
   Effect imports and refs a named exemption, the scratchpad, where they had the vendored kit or none: each law's
   doc says so.
4. **Staying small** (all four chosen): every experiment has a status (open; graduated, and where to; dropped) and
   `scratch:list` shows them with their age; no nested installs (a `package.json` or a lockfile inside an experiment
   is refused); graduate or delete (the folder goes in the same change and one line of what was learned stays in a
   log); a size and age limit as a warning in `scratch:list`, not a failed check.
5. **Starting points** (all four chosen), each a small template with a test that already runs, made by one command:
   a plain probe and its test; a service with a test layer; a Verify model with stories, refused with a sentence
   until `@alchemy.run/domain` is pinned in the repository and available after; a screen in the browser on a page of
   its own with the design system and atoms.
6. **Extra libraries?** Answer: "In the scratchpad's package.json". Only there, never in the app or a package, each
   named with the experiment that needs it; `deps:update` leaves them alone; deleting or graduating the experiment
   removes the library in the same change. Rejected: "Not at all".
7. **First contents?** Answer: "No, start empty". The Alchemy trial models stay where they are; the log points to
   the brief's trial page once that page is in `main`. Rejected: "Yes, the final model only"; "Yes, all rounds".
8. **When?** Answer: "After the sync commands".

Three defaults I was shown and accepted with the whole: the warning is at 30 days old or 200 files; an experiment
that needs a database or a dev server keeps its state in its own ignored folder (`.state`) and on its own port,
never the app's; trial code written while building something goes in the scratchpad, not a cache folder.

These were not put to me:

- **Status is not kept twice.** A note only ever says `open`: an experiment that graduated or was dropped has no
  folder, and its line in `scratchpad/LOG.md` says which. `scratch:list` reads both.
- **A library is named in its experiment's note** (`libraries:`), and `scratch:check` fails on a dependency of the
  scratchpad that is not a workspace package, not one the packages also use, and not named by a note.
- **The checks that keep it small run in `scratch:check`**, not in `bun run check` (answer 2).
- **The scratchpad's profile is the root's, with nothing turned off**: no third exception to the type-check.
- **The screen template is its own Vite entry** inside the experiment, served on port 5273 (`scratch:serve`). The app
  has no route to it, so its production bundle cannot change; the boundaries law holds that.
- **`config-sync` writes the scratchpad's dependencies** (every package under `packages/`, not the app), and
  **`version-sync` holds what it shares with the packages** to their versions. syncpack and `deps:update` do not
  read it.
- **Graduating does not move code.** The person moves it into a package and makes the check pass there;
  `scratch:graduate` deletes the folder and logs it.
- **No law refuses private names** on this branch: only key-shaped strings are read for (`laws keys`), in the
  scratchpad as everywhere. Answer 3's "private names" has nothing to hold it yet.

### 2026-11-22 — the scratchpad: a comment that hides a type error

`scratch:check` refuses `@ts-nocheck` and any Effect diagnostic turned off outside the one line decision 33 of the
Alchemy brief allows. I was asked: "In scratchpad experiments, `scratch:check` now refuses `@ts-nocheck` and any
switched-off Effect diagnostic. Should it also refuse `@ts-ignore` and `@ts-expect-error`, which each hide one type
error on the next line?" Options: "Refuse ignore, allow expect-error (Recommended)"; "Allow both"; "Refuse both".
Answer: "Refuse ignore, allow expect-error". I chose; the agent recommended the same. `@ts-ignore` hides an error
silently and keeps hiding it after the code is fixed, so `scratch:check` refuses it, in any capitals, in every file
the scratchpad's type-check reads. `@ts-expect-error` stays: it is how an experiment shows that a wrong call does not
compile, and it fails by itself once the error is gone.

### 2026-11-22 — dependencies: the catalog, Node's types, Better Auth, and sentences that record a check

Four questions left open when `deps:update`, `version-sync` and `config-sync` were built, answered by dialog.

1. **One catalog of versions at the root?** Options: "After Wednesday (Recommended)"; "As soon as these merges
   land"; "No catalog". Answer: "As soon as these merges land". I chose against the recommendation. Once `main` holds
   the branches open today, one commit: a top-level `catalog` in the root's `package.json`, `catalog:` in the
   workspace manifests, a new `bun.lock`, syncpack's catalog type and version group, and `vendor sync` writing
   `catalog:`. The Alchemy overrides and the files in `vendor/alchemy` stay as they are.
2. **`@types/node`, which `deps:update` would have moved from ^24 to ^26 while CI runs Node 22?** Options: "Hold at the
   version CI runs (Recommended)"; "Let it move to latest". Answer: "Hold at the version CI runs". I chose; the agent
   recommended the same. It is held at the major CI and `engines.node` name, and `version-sync` keeps the three
   together. It was ^24 and is now ^22.20.5 everywhere; every type error that appeared would have been an API the
   runner does not have, and none did (`bun run check`, 80 of 80). Where something truly needs a newer Node, the
   answer is to move CI's Node, not to work around it.
3. **`better-auth`, held back without my answer because its tables are a migration written by hand?** Options:
   "Hold it, and add the check (Recommended)"; "Hold it, no check"; "Don't hold it". Answer: "Hold it, and add the
   check". I chose; the agent recommended the same. The check existed as a slow test; it takes half a second, needs
   no secret, no network and no `.dev.vars` (an in-memory SQLite database and a dummy secret), and now runs in
   `bun run check` (`apps/inventory/test/server/AuthSchema.test.ts`). It fails when Better Auth wants a table or a
   column the migrations do not make, which is what `bun run auth:schema` would print.
4. **A sentence that records a check ("checked in effect 4.1.4's source") is moved by `version-sync --write`,
   though nobody checked again.** Answer: leave it as built. Not my decision: `--write` prints every line it
   changes, and the person reads them.

And: the scratchpad's lines in `CLAUDE.md` (the command table and the Layout) were written without my answer, as the
commands of the request that made it.

### 2026-11-22 — the review's model, a row decided after a group that is taken back

A group is taken back; a row someone decided after the group, with the group in force over it, recorded that
person's whole decision, the group's effect included. Today's review region would put back what the row held before
the group, and lose the later decision. Answer: "Row 14 stays whole". The row keeps that person's whole decision,
the group's effect included, and the screen names it. The model is right as it is; the review region's `act` is what
changes, at the move that puts the review on the model. The fold's property names the difference in a test of its
own, and compares the two only where one shared history has an answer. Reverse: a row's act over a group would have
to record only what it changed, relative to the groups under it, and the fold would read it so.

### 2026-11-22 — the review's model, a keep when a rival row is decided

For when keeping one of two rows (the review's keep) is in a model; it is in none yet. Answer: a decision someone makes on a
rival row wins over the keep, and two keeps of one SKU are both recorded and shown as a clash; no rival is left out
against a decision made on it. Reverse: before that model exists, nothing to undo.

### 2026-11-22 — the review's model, a waiting act when a group lands

For the screen, at move 3. Answer: an act waiting on a row the group does not touch is sent again by itself; one on
a row it touches is held and shown with both decisions. The model refuses either with `GroupedSince` and hands back
no number; what the screen does next is this rule.

### 2026-11-22 — the review's model, the lock, as built

His answer stands: "The library's lock file", and the hand-written list of rule names goes once the lock was shown to
catch a slipped rule. Shown on the one-unit model under `CI=true`: an invariant made to say less, a rule taken out, a
rule renamed (the old name refused, the new one "not in" the file), and a decision's rule whose text changed are each
refused by name. What the lock cannot catch, shown too: with a check removed from `UndoingGroup`'s `decide`, the rule
it protects is only `checked`, nothing is undone, the report is verified, and the lock is silent, since the rule's
text is unchanged. So the list is gone, and two assertions stay, each for one case the lock misses: every rule
stands as its kind says (proved; checked for a model's invariant; reached for a `sometimes` rule), and every decision
that records on a row or a group states the three rules about who may change it, held in each decision's proof and
again over the whole model. This answers what the lock entry above left open, in his words:
"if the lock alone can't catch something the list does, show me the case and keep one assertion for exactly that;
otherwise remove the list." What the change costs: a rule taken out or renamed now fails only where the lock runs,
the search of the whole model (`bun run check:full`, CI's proofs job), not `bun run check`. Reverse: put the lists
back in `test/rules.ts`.

### 2026-11-22 — the review's model, its long tests outside the loop check (not asked)

The fold's property (76 to 85 seconds) leaves `bun run check`: it is the task `fold` of the catalog's web package,
replayed by turbo until that package or what it reads changes, part of `check:full` and of CI's proofs job, not of
CI's main job. The mutants of the model (148, ported from an earlier trial of it: 116 noticed by a proof, 32 by a
story only, none by neither; 24 minutes four at a time on a busy workstation) are a task the nightly workflow runs
whole, with a sample of nine (about 22 seconds) in
`check:full` and in the proofs job, and every night in a job of its own. Not a decision of his: made while building
the model, and his to reverse. Reverse: rename `ReviewModelFold.fold.test.ts` back to `ReviewModelFold.test.ts`, drop
the two projects and the `fold` script of the web package, remove the `fold`, `mutants` and `mutants:sample` tasks
from both `turbo.json` files and the model package's two scripts, and take them out of the root's `check:full`,
`proofs` and `proofs:nightly` and of both workflows.

### 2026-11-22 — the review's model, the lock and the library's list of what must stay proved

The lock keeps each rule's text, not how it stands, so his first answer ("The library's lock file") left a rule that
stops being proved unseen. Question, put again with that shown: what holds how each rule stands? Answer: "Lock plus
the library's proved list". The lock catches a rule removed or reworded; Verify's `require: { proved }`, given a
list of rule names, fails when a named rule is no longer proved. No hand-written assertions of ours. Built so: the
list given to `require` is the lock's rules of the kinds a proof covers (an aggregate's invariant and transition, a
decision's rule, a relation), 135, so the two never disagree. Shown under `CI=true`: with the check of
`UndoingGroup` that refuses an undo behind a later group deleted, "UndoGroup.OnlyTheLastGroupInForceIsTakenBack is
required to be proved, and is only checked"; with `DecideRow.AViewerChangesNoRow` taken out, both the list and the
lock name it. `Prove.report` and `Prove.decisionReport` take no lock and no `require`, so each proof file keeps the
smallest check of ours that fails when a rule stops being proved: every rule its report names is proved. The two
assertions this replaces (every rule to its kind's standing; every decision on a row or a group states the three
rules about who may change it) are gone; nothing now checks the second for a new decision. Reverse: drop `require`
and put back the assertions of the entry above. The second came back the same day: see "whose act a decision
records" below.

### 2026-11-22 — the review's model, a press over a group that changes nothing

A press on a row a group in force covers, that leaves the row reading as it already reads through the group. Before,
the model recorded it as the sender's whole decision, the group's effect included, so the group's undo left that
effect on the row. Answer: "No change, Ana's undo applies". Such a press is answered "no change" and recorded as
nobody's; the group's undo then takes its effect off the row. `DecideRow` gains `asItReads`, the sender's word, like
`covered`: on a covered row the act changes nothing when it leaves the row reading as it reads; on any other, when its
text is what the row's own instance holds. Every rule that tested "no change" reads it through the same test. The
story: Ana's group over twelve rows, Dana's press on row 14 that changes nothing records nothing, Ana takes the group
back, and row 14 holds nothing; it fails with the old test put back. "Row 14 stays whole" holds only for a press that
changed the row. All rules proved again: `DecideRow` at 176 paths, from 152. A mutant puts the old test back. Reverse:
remove `asItReads` and test "no change" as `!covered && leavesAsItIs(...)` again.

### 2026-11-22 — the review's model, a covered press from a screen that is behind

A fault in the entry above, found on review: the covered "no change" was answered before the checks of what the
sender saw (`saw`) and of the matching. A press from a screen that is behind was then lost as "no change": Ana's group
leaves row 14 out, Dana types 8 on row 14, and Carl, whose screen has the group and not Dana's 8, presses "leave out"
there. On his screen the row reads as his press leaves it, so he sends `covered` and `asItReads`, and the model
answered "no change" over a decision he never saw. His answer on a press that met another's decision stands: "Same:
hold, show both". Now the press that leaves the row's own instance as it is, with no group over it, is still no change
whatever the sender saw; the covered one is no change only after `saw` and the matching pass, so Carl's is refused
with Dana's decision and his screen holds it beside hers. The rules that a decision is replaced only by an act that
saw it, and that an act is made on the matching now, excuse only the first kind. The story is Carl's, and it is the
only thing that holds the order: it fails with the covered answer put before `saw` (a mutant does that), and no rule
can, since a rule is checked only on a path that records and "no change" records nothing.

How the `decide` is written matters to the prover. With the uncovered answer first, then the checks, then
`cmd.covered && cmd.asItReads`, the relation "a row belongs to its import's organization" was no longer proved across
`DecideRow`: past 4,096 paths, and `verify` failed on it. The prover takes both sides of `covered` each time the code
asks it. So `covered` is asked once and each side makes its own checks of `saw` and the matching, in the same order
for the person; each of those checks has its own mutant (154 in all). `DecideRow` at 284 paths in its own proof, from
176; the lock was written again on purpose for the two rules' new text. Reverse: answer the covered "no change" with
the other one, before `saw`, and accept that such a press is lost.

### 2026-11-22 — the review's model, a press that matches what the row holds, from a screen behind a group

Found on review of the entry above, and older than it: the uncovered "no change" also trusted the sender's word
(`covered: false`) before the check of what the sender saw. Dana accepts the fix on row 14 (change 1). Ana's group
covers row 14 (change 2). Dana types 8 on it (change 3), and Carl's screen has all of that. Dana takes the 8 back: the
row holds her accept of change 1 again, and the group, made after it, covers the row again. Carl, who has not
received the undo, presses accept on what he sees as an uncovered row holding the 8. The model answered "no change",
since the accept is what the row's own instance holds, and dropped the press; recorded, it would have put the accept
over Ana's group. Question: should a stale press that happens to match what the row holds be dropped or held?
Options: "Hold it when behind (Recommended)", "Keep 'no change' as decided". I chose "Hold it when behind"; the agent
recommended the same. It narrows my answer of 2026-11-19 ("no change, whoever decided it and whether or not the sender
has seen it") for this one case.

Built so: on an uncovered row the early "no change" is answered when the sender has seen what the row holds, or when
no group was made since the row's own decision (on a row with none: no group at all). Otherwise the press goes to the
check of what the sender saw and is refused with what is there (`DecidedSince`, or `NoLongerThere` on a row left with
no decision), so the screen holds it and shows both. With no group since, a press that matches is still no change,
seen or not, as before. The two rules that excused every such press (a decision is replaced only by an act that saw
it; an act is made on the matching now) excuse only the one answered "no change"; the lock was written again on
purpose for those two. Three stories hold it (the six steps above, refused with Dana's change 1; the same on a row
left with no decision; and the earlier "seen or not" one, with a press from a screen that still shows a decision taken
back), and four mutants, each held by its story: no rule can, since a press answered "no change" or refused records
nothing (the proof notices them only by its count of paths).

The same review found the matching half of the covered order held by nothing. It has a story now (Ana's group, Dana
matches a column, and Carl's covered press on the matching before is refused with the matching now, then is no change
once his screen has the match) and a mutant that answers the covered "no change" before the check of the matching.

`saw` is asked once in each case of the row, for the prover's paths: `DecideRow` at 368 paths in its own proof, from
284, and the relation of a row to its import's organization still proved across it; 135 rules proved under `CI=true`.
159 mutants. Reverse: answer the uncovered "no change" first again, as the entry of 2026-11-19 says, and accept that
such a press is dropped.

### 2026-11-22 — the review's model, whose act a decision records, held by a check of ours again

The check that every decision recording on a row or a group states the three rules about who may change it
(`missingRules`, in each decision's proof) is back. "No hand-written assertions" was about asserting how each rule
stands, which the lock and `require.proved` do; this check guards what the library does not. A row and a group have no
command and so no middleware of their own: a decision that records on one says
whose act it records only by stating those rules, and without them it would lock and prove and let anyone change the
row. It came back without my being asked, so it was put to me. Question: one check of ours remains; each decision
that records on a row or a group must state the three who-may-change rules; does it stay? I chose "Keep it, named as
ours"; the agent recommended the same. The documents say it is ours and why, and "no hand-written assertions" means no
hand-written list of rule names or of how each stands. Reverse: drop `missingRules` from `test/proving.ts` and the
four proofs.

### 2026-11-22 — the review's model, several people on one import

An answer, after the cases above were explained to me (Ana, Dana and Carl are invented names for people reviewing
one import at once).

Question: the review by several people at once, as built and proved: keep it, and how are its remaining edge cases
settled? I chose "Keep it, stop asking me"; the agent recommended the same. What is built and proved stays. For an edge
case that remains, one rule is applied without asking me: a press from a screen that is behind is never dropped
without a word and never applied; it is held and shown. Each case settled by that rule is listed where the work is
reported, so I can overrule it. A case where the rule itself cannot be kept (the prover's path limit) still comes to
me.

What is stored already is the entry "rows already stored: start empty" below.

### 2026-11-22 — the review's model, decided by the rule, for me to overrule

A review of the model on main found cases nobody had put to me. Each is settled here by the rule above (a press from
a screen that is behind is never dropped without a word and never applied; it is held and shown), or by what I
answered before, and not asked. I can overrule any of them.

1. **The same decision made again on a newer matching is a change.** "No change" needs the same text and the same
   matching. Ana keeps row 12; Dana matches a column; Ana, with the match on her screen, keeps the row again: it is
   recorded, on the matching now. Before, it was answered "no change" and the row kept the old matching for good.
   Whatever it decides, a press made on an older matching is refused with the matching now, a press that matches
   what the row holds included. Reverse: compare the text only, in `leavesAsItIs`.
2. **A row's decision is not taken back from under a later group.** Dana types 8 on row 14; Ana's group, drawn on a
   screen that had the 8, covers the row; Dana's undo of the 8 is refused naming the group (`GroupedAfter`), as a
   group's undo under a later group is, and is taken once the group is taken back. Before, it was taken, and the group
   then read over a row its maker never saw. `UndoRowStep` gains `covered`, the sender's word from a screen that has
   every group act. Reverse: remove `covered` from `UndoRowStep` and its check.
3. **A refusal says what happened.** When the decision the sender saw was taken back and an older one is there again,
   the refusal is `PutBackSince` with whose older decision it is, not `DecidedSince`: nobody decided the row since.
   The six steps of the entry "a press that matches what the row holds" are refused this way.
4. **A covered press sent twice is written once and answered the same.** The resend is known by the row holding this
   very act: the sender's, under the same step, with the same text. It is answered with nothing new recorded, not
   refused with the sender's own decision. The library gives a decision no number of the command to know a resend by.
5. **A group's undo touches no row.** This stands by my answer "Row 14 stays whole": the undo takes back its
   sender's own act, so a row decided since keeps that person's whole decision, and the screen names it. The answer
   is the group's undo and its number; which rows were decided since and stay is read from the rows, not carried in
   the answer: the model keeps no reading of a group's rows. This item first said the undo is therefore taken from a
   screen that is behind on the rows; my answer was on what the row keeps, not on that, and 16 holds the press.
6. From the entry above: a row left with no decision is guarded as a decided one is (a "clear" from a screen that
   still shows a decision there, after a group, is refused `NoLongerThere`); and with no group made since the row's
   own decision, a press that matches what the row holds from a screen that is behind is still "no change".
7. **An undo sent twice is written once and answered the same** (added the same day, by the same rule as 4). A row
   keeps the last undo it took: the change taken back, the step the undo was pressed in, and who pressed. Dana takes
   back her keep on row 12 and the answer is lost; her screen sends the undo again: nothing more is recorded, and
   she is not told `NotYourStep`. It is known whatever was decided on the row since, and only as hers, in that step,
   of that change. Before, the second sending was refused as an undo of a decision the row no longer holds. Reverse:
   remove `undone` from the row's state and the check in `Undoing`.
8. **A press drawn before an undo on the row is held** (2026-11-22, a second review). After an undo the row holds
   exactly what it held before the decision taken back, so the number of the row's decision cannot tell a press made
   after the undo from one drawn before it. Dana types 8 on row 14 and takes it back; the first sending of her 8,
   stalled on the way, arrives: before, it was written again, on the row she had cleared. Now `DecideRow` says the
   last undo its screen has of the row (`sawUndone`: the change that undo took back), and a press without it is
   refused `UndoneSince` with who took the undo and of which change. The same holds for another person whose screen
   has the older decision and not the undo: before, their press was taken; now it is held and shown. Reverse: remove
   `sawUndone` and its check.
9. **A press sent twice is answered as the first time when a match landed between, on a row no group covers too.**
   Before, the copy was refused `MatchedSince` though the row held that very act. Known as in 4: this step, from
   this person, with this text on the matching it was made on.
10. **A row's undo is made on the matching now.** It puts another person's decision back on the row; from a screen
    that has not received a match it is refused `MatchedSince` and held, as a row's act is. `UndoRowStep` gains
    `madeOn`. With this, no undo from a screen that has not received a match is taken.
11. **What `GroupedAfter` names for a row's undo is the import's last group in force**, the one to take back first,
    and its words say so. It is the group over the row or one made after it: the model keeps no reading of a
    group's rows. The rule that held it was named for more than it reads and is renamed: a row's undo that is taken
    is one whose sender said no later group covers the row.

12. **An undo's copy is answered as the first time when a group act, or a confirm and a reopening, landed between
    the two sendings** (a third review, the same day). Before, the copy was refused `GroupedSince` or
    `ConfirmedSince` though the row had taken that very undo.
13. **A row keeps its last undo only, and this one cannot be kept by the rule.** A copy of an undo that arrives after
    another undo on the same row is refused `NotYourStep`, with nothing wrong stored. To know it, the row would have
    to keep every undo it took. Tried: a text of them looked into with `includes`, which the prover does not read
    (every rule of the undo comes back "not read"); not tried, read from the library: a list in the state, whose
    rules are then proved for short lists only and not proved. For me to settle if it matters.
14. **A press's copy is answered as the first time when a group act, or a confirm and a reopening, landed between
    the two sendings** (a fourth review, the same day; 12 said it of an undo only). Before, the copy was refused
    `GroupedSince` or `ConfirmedSince` though the row held that very press: this step, from this person, with this
    text on the matching it was made on.
15. **A row's undo from a screen that has not received an undo on the row is held** (2026-11-22, a later review).
    Dana keeps row 12, Ana leaves it out and takes that back: the row holds Dana's keep again, as her screen shows
    it, and her screen has neither of Ana's acts. Before, her undo of her keep was taken from that screen; now
    `UndoRowStep` says the last undo its screen has of the row (`sawUndone`, as `DecideRow` does in 8), and a press
    without it is refused `UndoneSince` with who took the undo and of which change. Once her screen has Ana's undo
    the same press is taken. Reverse: remove `sawUndone` from `UndoRowStep` and its check. This item first said the
    case was not decided by the rule and left the press applied; the rule decides it, as it does 8.
16. **A group's undo from a screen that has not received every change of the import is held** (2026-11-22, the
    review after that). Ana's group covers row 14, Dana types 8 on it, and Ana, whose screen has not received the 8,
    takes her group back. Before, the undo was taken, and Ana learned only afterwards that row 14 stays as Dana
    decided it. Now `UndoGroup` says every change its screen has (`seen`, as `DecideGroup` does), and a press without
    them is refused `ReviewMovedOn` with the import's last change; once her screen has the 8 the same undo is
    taken, and row 14 stays whole as in 5. The check is of the whole import: the model keeps no reading of a
    group's rows, so a change on a row outside the group holds the undo too, until the screen has it. Reverse:
    remove `seen` from `UndoGroup` and its check.

With 1, the two rules "a decision is replaced only by an act that saw it" and "an act is made on the matching now"
excuse nothing any more: every act that records saw the row's decision and was made on the matching now. On a row no
group covers the matching is checked first, so a press behind on both is refused with the matching.

The prover's limit decided how 1 is written. As two comparisons (the text, then the matching) the relation of a row to
its import's organization was no longer proved across `DecideRow`, in three forms: 232, 226 and 220 paths in the
decision's own proof, each past 4,096 for the relation. What counts there is how many ways through the `decide` reach
the record, and "the text differs, or the text is the same and the matching differs" is two. As one comparison (the
matching's number and the text as one text, `onItsMatching`) it is one, and the relation is proved: 204 paths, and
`UndoRowStep` at 300 from 298. 136 rules proved under `CI=true` (one new: a row's undo is not from under a later
group); the lock written again on purpose for the two rules above. 55 stories, 165 mutants.

With 7: `UndoRowStep` at 324 paths, 139 rules proved under `CI=true` (three new, each one comparison: the row keeps
which change was taken back, the step it was pressed in, and who pressed), 56 stories, 169 mutants.

With 8 to 11: `DecideRow` at 222 paths and `UndoRowStep` at 326, the relation of a row to its import's organization
still proved across both (the first form tried); 61 stories, 179 mutants. With 12: `UndoRowStep` at 362 (the test
worked out once before the refusals gave 814), 63 stories, 184 mutants.

Rules that said less than their names, each either made to say it or renamed (the same review and the one before):

- Made to say it, each a new rule: an undo stops where the history was let go (the refusal `HistoryEnds` had no
  rule); an undo is of a row, or a group, of the import it names (only the organization's half of that check had
  one); a group keeps its count; a group's change is one its import gave, from above as well as from below; no group
  in force is later than the one its import holds as the last in force (the last two are searched, not proved).
- Renamed to what they read: `AConfirmLeavesAClosedImportsStatusAsItWas` (was "a confirm of a closed import writes
  nothing"), `TheMatchingMovesOnlyOnAnOpenImport` (was "only an open import is reviewed"),
  `AGroupSaysAtLeastOneRow` (was "a group has rows": the count is its sender's word),
  `ARowsUndoSaysNoLaterGroupCoversIt` (11 above).
- Taken out, because they could not fail where they stood: "nobody clears another person's decision" on a row's
  act, which always leaves a decision there, and "nobody undoes another person's group" on a group's act. Both stay
  on the undos. The check that a decision states who may change a row or a group now asks by the event recorded, so
  it is never satisfied by a rule that cannot fail.
- Said as they are, in words only: `replaced` on an import counts replacements as the confirms said them, not
  items; a group's rows are bounded at a million characters, which takes 50,000 ids at their longest.

143 rules of the kinds a proof covers under `CI=true`; the lock written again on purpose for these. With 14:
`DecideRow` at 234 paths, the relation still proved across it, no rule changed; 65 stories, 190 mutants. With 15:
`UndoRowStep` at 364 paths, one rule more (144 of the kinds a proof covers under `CI=true`), the lock written again
on purpose for it; 66 stories, 191 mutants. With 16: `UndoGroup` at 86 paths, one rule more (145), the lock written
again on purpose for it; 66 stories, 192 mutants.

### 2026-11-22 — the review's model, rows already stored: start empty

Nothing the app has stored today (imports, items, organizations) is carried into the model. His answer: "Start empty
(Recommended)"; I chose; the agent recommended the same. It replaces the alchemy-domain brief's decision 37 answer
"Adopt at first touch", and the mechanism he then picked for it, the same day. Each move's migrations create the
model's tables on an empty database, its seeds are written for the new model, and local development data is reset
with `bun run db:reset`; no carry-over code or test exists. Recorded in full in the alchemy-domain packet's
DECISIONS.md. Reverse: a new decision by him, before the first deploy he keeps holds data.

### 2026-11-22 — the screen at move 3: an undo waiting when a group lands, and a keep's rivals

For the screen, not the model. His answers: "a waiting undo on a row a landing group doesn't
touch is sent again by itself; and for a keep, a rival with only accepted fixes is left out, as today, while one
someone kept or edited makes a clash." The first adds the undo to the entry "a waiting act when a group lands". The
second refines the entry "a keep when a rival row is decided": accepting a fix on a rival row is not "a decision made
on it" that wins over the keep; keeping it or editing it is. Reverse: a rival with accepted fixes makes a clash too,
as the earlier entry reads on its own; a waiting undo is held like a waiting act.

### 2026-11-22 — the scratchpad: its install

The scratchpad was built as a workspace of the root, so the root's install, on CI and in every deploy, installed what
its package.json asked for, a library an experiment added included, and `bun run check` read that package.json. That
went against answer 2 above (its own commands only). Measured before asking: outside the workspaces, every package
and every library still resolves from the root's one `node_modules`, the templates pass their tests and the
type-check, and a library added in the scratchpad goes into its own `node_modules` and lockfile, the root's
untouched.

1. **The scratchpad's install?** Options: "Out of the workspaces, its own lock (Recommended)"; "Keep it a workspace";
   "Workspace, no libraries of its own". Answer: "Out of the workspaces, its own lock". I chose; the agent recommended
   the same. Its package.json lists only libraries experiments added; the repository's packages and the shared
   libraries resolve from the root's install; CI and a deploy never install an experiment's library; `bun run check`
   reads the scratchpad only for the import boundary, keys and private paths. Its costs, each said before I chose: a
   second lockfile against "one lockfile" (the one exception, for the scratchpad as a whole: answer 4 still refuses an
   install inside one experiment); a library with its own `effect` would be a second copy, so a library the root
   already has never goes there (`scratch:check` refuses it); an experiment cannot try another version of React or
   Effect; the CLI keeps the scratchpad's configuration, so CI reads nothing of the folder.
2. **Its lockfile?** Options: "Committed (Recommended)"; "Ignored". Answer: "Committed". I chose; the agent
   recommended the same. bun writes `scratchpad/bun.lock` with the first library; `scratch:check` asks for it once
   the scratchpad lists one.

This was not put to me: the Verify template takes the prover from the root's install (a library of the
scratchpad would be a second Effect), so it works once a package asks for `@alchemy.run/domain`, and until then
`scratch:new` says so.

### 2026-11-22 — releases and deploys: trunk, release branches, tags

He asked, in his words: "We should also setup deploys only on release branches with tags for releases. I'm thinking
we follow some kind of trunk based strategy". Four questions by dialog; each answer was the recommended option.

1. What deploys production? Answer: "A tag on a release branch". Work lands on `main`; a release is cut as
   `release/<major>.<minor>` from `main`; pushing a tag `v<major>.<minor>.<patch>` on that branch deploys production;
   a fix to a released version lands on `main` first and is cherry-picked onto its release branch, then tagged with
   the next patch. `main` never deploys production. Rejected: "A tag on main, no branches". I chose; the agent
   recommended the same.
2. What does `main` deploy? Answer: "A staging stage". Every green push to `main` deploys one staging stage.
   Rejected: "Nothing"; "Pull-request previews only". I chose; the agent recommended the same.
3. Does each production deploy wait for my approval? Answer: "Yes, I approve each one": the production job waits on
   the `production` environment's required reviewer. I chose; the agent recommended the same.
4. How is a release cut? First answer: "One repo command", in his words "maybe changsets too for our packages. I
   recommend you look up the turbo documentation on this". Turborepo's guide recommends Changesets only for packages
   published to npm and calls the others Internal Packages; every package here is private. Second answer: "App
   version only, for now": one version for the app, set by the release command and tagged on the release branch; the
   packages stay Internal Packages; Changesets is added only if a package is ever published. Rejected: "Trial
   Changesets first"; "Changesets now". I chose; the agent recommended the same.

Built as: `bun run release` in the repository's CLI (`docs/releasing.md`); `.github/workflows/deploy.yml` deploys
staging after CI passes on `main`, and production only from a `v*` tag whose commit is on a `release/*` branch,
behind the `production` environment; the previews are unchanged. Reverse: production on a push to `main` again in
`deploy.yml`, and the `staging` stage out of the stage plan.

These were not put to me:

- The approval stays as code. The `production` environment and its reviewer are already made by the repository's
  stack (`packages/infra/src/GitHub.stack.ts`, decision I7), so nothing is clicked in GitHub's settings: the stack
  now leaves the environment open to any ref (Alchemy's GitHub provider writes only branch rules, and deletes any rule
  it did not write, so a `v*` tag rule could not be kept there), and a tag ruleset lets only an admin create, move or
  delete a `v*` tag. The deploy job checks the tag and its branch itself, and the reviewer approves each one. Until
  he deploys that stack again, GitHub still allows only `main` to deploy to production, so a tag deploy waits there.
- The staging stage is named `staging`, answers on `workers.dev`, and is a rehearsal like a preview: the test
  organizations and accounts, sign-up closed (decision I8: no real email outside production), and no model key:
  decision I5 gives one to production only, so the missing-model-key guard has nothing to guard and the rules answer.
  Its test accounts take the one password the previews share. It runs on the previews' Cloudflare account.
- The release notes are the conventional commits since the last tag, grouped by type, written to `CHANGELOG.md` and
  into the annotated tag's message. The app's version is `apps/inventory/package.json`; the "(v0.6.1)" in
  `README.md` names the version that was submitted and is never moved.

After the review of 2026-11-22 the agent changed these, and I was not asked:

- "Main" in every release rule is `origin/main`, fetched by the command itself, never the local `main`; a release is
  cut only from `main` exactly where the remote's is. A fetch that fails stops the release.
- A patch refuses a merge commit and a branch that does not hold its line's last tag. `release verify` holds every
  rule again on the tagged commit (a release commit, over commits main holds), and refuses when git cannot answer.
- The release commit also moves `bun.lock`'s copy of the version. `CHANGELOG.md` and the version stay on release
  branches only; a new line's changelog starts from the last release's. `main`'s version file is not moved by a
  release. Whether `main` should carry either is mine to change.
- Staging deploys only `main`'s head, so a check run again for an older commit never puts it back.
- Each deploy job waits in its own group, one for each release tag.
- A test that was tried again after a hang or a falsified property fails the run, even if a later try passed: the
  reporter reads every error of every try, which vitest's retry condition cannot.

After that review I was asked three questions by dialog, on 2026-11-22:

1. Where production's gate lives. GitHub's `production` environment named no branch or tag, so the rule "only from
   a release tag" lived in the workflow file the tagged commit itself brings. Answer: "After CI on the release
   branch (Recommended)". I chose; the agent recommended the same. Production starts when CI passes on a push to
   `release/**` whose head commit carries its annotated `v*` tag. GitHub runs `main`'s copy of the workflow and of
   the tag check for that, the `production` environment gets its `main`-only rule back, and I push branch and tag
   together: `git push --atomic origin release/0.7 v0.7.0`. A tag pushed alone starts nothing. My approval stays.
   Rejected: a push to `release/**` as the trigger with a `release/*` rule and admin-only release branches; leaving
   it as it was with the approval as the only gate. This rests on GitHub's documented `workflow_run` behaviour and
   is not verified on GitHub: the first real release is where it is.
2. Staging's Cloudflare credentials. Answer: "Keep sharing, say so (Recommended)". I chose; the agent recommended
   the same. Staging keeps the previews' account and token, and the code and the documents say plainly that a
   pushed branch can reach staging. Rejected: a third account for staging; a required reviewer on `preview`.
3. A fix that needed edits when it was cherry-picked. Answer: "Accept, and name it (Recommended)". I chose; the agent
   recommended the same. A commit whose change differs from main's counts when its `git cherry-pick -x` line names
   a commit that is on `origin/main`; the release's output, its notes and its tag message list it under "Picked
   with changes". No flag. Rejected: always refusing it; accepting it only behind a flag.

The agent chose these while closing the second review of that build, and I was not asked. Each can be reversed in
`Release.rules.ts` or `deploy.yml`:

- The pick's line counts only alone on a line, as `-x` writes it. Nothing compares the edited change with main's;
  the documents and the "Picked with changes" lines say so, and that the approval screen shows none of it.
- A release commit made by hand passes only when the app's file and `bun.lock` are their parent's with the version
  moved. The text of `CHANGELOG.md` is not compared.
- A patch is refused, by the command and by the deploy guard, when a release of its line under it is one the guard
  refuses, or was never pushed. A bad tag stops its line until an admin deletes or replaces it.
- Production asks the remote again after my approval: the commit must still be its release branch's head and carry
  the tag, or the job fails. Nothing orders the releases of two lines.
- The failed "Deploy" run after each green push to `main`, until I deploy the repository's stack with the `staging`
  environment, is left failing and written down, not skipped.

### 2026-11-22 — atoms A1, the kit too

Question: A1 left the vendored kit (`packages/ui/src/components`, `packages/ui/src/hooks`) its own React state. I
saw the `React.useEffect` in `packages/ui/src/hooks/use-data-table.ts` and asked: "I still see react hooks did we
finish the atom migration?", then said "Yeah we will still want to migrate this to atom". How far, and when?
Answer: "Whole kit, table first (Recommended)". I chose; the agent recommended the same. Every file of the kit that
calls a hook moves to atoms under the rule our own code has: no effect hook, another hook only where no atom can do
the job (a DOM ref, a hook of TanStack Table, TanStack Virtual or react-hook-form, which stay by A4). The data table
goes first, then the rest in batches, each checked and merged; nothing a person sees changes. The kit stops being
as published: a changed file is marked as changed here, and a later update of it from its registry is merged by
hand. This ends the last clause of "atoms A1, what stays a hook" ("the vendored kit is not ours"). Rejected: the
table only; the kit left as it is. Reverse: take a file again from its registry and add it back to the lint's
ignore list. The batches are in `goals/atoms/PLAN.md`, "The kit on atoms".

### 2026-11-22 — infra: the stacks read their secrets through Alchemy's 1Password provider

Question: the by-hand deploy ran every stack under `op run --env-file packages/infra/env/op.env`. Should the stacks
ask 1Password themselves?
Answer: "Or even better use alchemy's built in 1password", then "Yes, add it" (keep `@alchemy.run/1password` as a
file at the commit already pinned) and "Yes, wire it". I chose; the agent had built the `op run` way first and
recommended neither. Each stack lists a `secrets` entry that hands the references its stage needs to the provider;
`op run` is gone from every deploy line and from `bun run beep infra setup`. The agent told me this would move the
references into the stacks' code; as built it does not: they stay in `packages/infra/env/op.env`, which the entry
reads, and no code holds one. In a workflow the entry does nothing. Production's Alchemy profile is connected to
1Password, and the app's "Integrate with other apps" must be on. Not tried against 1Password: the provider was never
called by an agent. Rejected: keeping `op run`. Reverse: remove `secrets` from the two stacks and the dependency from
`packages/infra`, and wrap the deploys in `op run` again (`git log` has both lines).

### 2026-11-22 — infra: previews and staging deploy with my own Cloudflare token

Question: the repository's stack made a deploy token in each Cloudflare account with the one login it is deployed
with. That login does not reach the account for previews, test stages and staging, so the stack could not make
its token there. How does that account get its deploy key?
Answer: "Use my own token". I chose; the agent recommended the same. The stack no longer makes a token in the
previews' account: it asks 1Password for the account-owned token I made there and for the account's id, by the two
references I keep in `packages/infra/env/op.env.local` (git ignores it), and writes them to the `preview` and
`staging` environments. Production's token is still made by the stack, with only what a deploy needs. What I accept:
my token is broader than one made for the purpose, since it allows whatever I gave it; every preview job and every
staging job holds it, so anyone who can push a branch can use it; and I rotate it myself (a new token in that
account, its value into the 1Password item, `bun run beep infra setup --staging`, then revoke the old one). The
setup command checks the token's permissions against what previews and staging make and says what is missing before
anything is made. Rejected: adding production's login as a member of the second account, so the stack could keep
making a narrow token there. Reverse: add that login as a member, put `PreviewDeployToken` back in
`packages/infra/src/GitHub.stack.ts`, and deploy the stack; the plan then replaces the two secrets.

### 2026-11-23 — the defaults law: what stays on purpose, and the order of the sweep

Question: the law that counts fallbacks, absence checks, unwraps and clean-ups in code was on `main` with 2,027
places in 239 files. Seven things were open before the places could be moved onto schemas.
Answer: I chose each; the agent recommended the same each time.

- A cell of a file the person reviews keeps its reader. The small function that returns a value or a reason stays,
  and its trim or change of case stays in it: no schema decodes a cell to a clean value. Rejected: a schema that
  does the clean-up and hands the review a proposal; a schema that decodes only after the person accepted.
- The law tells those places by file. It holds a list of files, each with the kinds it keeps and the reason
  (`exemptions` in `Laws/Defaults.rules.ts`), and code that reads a cell is gathered into such a file. It starts
  with `CellReading.rules.ts` and its 15 clean-ups; what reads a cell inside `Review.rules.ts` (41 clean-ups) and
  `Suggest.rules.ts` (15) moves during the sweep. Rejected: a comment on each line; leaving them in the baseline.
- An optional prop of our own React component stays `?:` and takes its default in the destructuring. `Option` is for
  data that came through a schema. Rejected: every optional prop an `Option`; the law exempting props.
- A default on a parameter or a destructured name is counted as a fallback in every `.ts` file and left alone in
  `.tsx`. It added 143 places: the baseline stands at 2,155 in 253 files. Rejected: counting only in contract, model
  and host packages; not counting.
- The sweep starts with the catalog's contract, model and host packages. Rejected: the small server packages; the
  review region; the catalog's screens.
- That first sweep is done when no line of the baseline names those three packages, the exempt files apart. A place
  that seems to need staying is a question to me. Rejected: a pull request for each package; best effort with a list
  of what was left.
- One session does the first sweep by hand as the worked example; after it Codex lanes take a package each.
  Rejected: a session for each package; Codex lanes from the start; no sweep, the ratchet only.

Not decided: whether a cell reader's fallbacks and absence checks are exempt too. `CellReading.rules.ts` holds 12
and 14, and the law still counts them. Reverse, for parameter defaults: take the `AssignmentPattern` line out of
`internal/defaultsCode.ts` and its name out of `whatIsCounted`, then run `bun run beep laws defaults --write` (the
baseline's `reads` no longer matches, so it is written anew). Reverse, for an exemption: taking a file off
`exemptions` counts its places again, and the baseline does not rise to hold them, so they move onto a schema in the
same commit. That is what the reversal means: those cells no longer keep their reader.

### 2026-11-23 — the defaults sweep's pilot: cell readers, cell rules and the SKU key

Question: three things the pilot reached that the law's first entry left open or did not foresee: whether a cell
reader's fallbacks and absence checks are exempt as its clean-ups are; where the cell reading in `Review.rules.ts`
and `Suggest.rules.ts` goes; and where `skuKey` goes, since as a schema transformation it would need
`S.decodeSync`, which the type-check refuses (`schemaSync`).
Answer: I chose each; the agent recommended the same each time.

- A cell reader is exempt for clean-ups only. Its fallbacks and absence checks move like any other: the vendors and
  dimensions JSON in a cell is decoded by its schema with `Option` fields, and a regex group is read as an `Option`.
  `CellReading.rules.ts` keeps its trims and changes of case, and nothing else. Rejected: all four kinds exempt.
- The cell reading in `Review.rules.ts` and `Suggest.rules.ts` moves to a new `Review/CellRules.rules.ts`, each
  field's check and proposal, and that file goes on `exemptions` for clean-ups. `Review.rules.ts` keeps the fold,
  the counts and the decisions with no clean-up. Rejected: listing `Review.rules.ts` and `Suggest.rules.ts`
  themselves; moving everything into `CellReading.rules.ts`.
- `skuKey` moves to its own file, `Item/SkuKey.rules.ts`, on `exemptions` for clean-ups, its reason beside it.
  Rejected: decoding a `SkuKey` once where a SKU enters, which changes the staged and stored row shapes.

Also: the main checkout is mine while the sweep runs; the sweep works in `.claude/worktrees/defaults-check` on
`feat/defaults-contract-step`, and the branches are joined when I say so.

### 2026-11-23 — the defaults sweep's pilot: word comparers, and the defaults nobody decided

Question: 43 trims and changes of case in the pilot sit in pure code that reads no file cell: the table assistant's
words, the search's words, the in-memory twin's filters, a sheet's header keys, a heading's key, the item editor's
boxes and the D1 adapter's number filters. And the defaults nobody decided (SPEC), which the pilot kept as they were
and moved onto schemas.
Answer: I chose each; the agent recommended the same each time.

- Files that compare words or headings go on `exemptions` for clean-ups only: `Assistant/TableView.rules.ts`,
  `Item/ItemSearch.rules.ts`, `Catalog.memory.ts`, `Reading/SheetLayout.rules.ts`, `Review/Mapping.rules.ts`. They
  never store the cleaned text. Rejected: every one a schema transformation; leaving them counted.
- The item query's number filters are trimmed by a contract schema, `TypedNumberText` (`ItemQuery.command.ts`), which
  the D1 adapter decodes. The item editor's boxes are read with the cell readers (`cellValue`, `isBlank` in
  `CellRules.rules.ts`), because the editor reads a box exactly as the import reads a cell, which its file already
  says. That is not the schema the recommendation named: a schema there would decode a string that cannot fail and
  hand back an Option with nothing to fall back to.
- The question's premise was only half right. `S.decodeSync` is refused in pure code (`schemaSync`), but
  `S.decodeUnknownOption` is not: `CellReading.rules.ts` already uses it. The reason the word comparers stay as they
  are is that last point (an Option where nothing can be absent), not that a decode is impossible.
- A dimensions cell that names no unit reads as cm, as it did (root DECISIONS.md). The other defaults nobody decided
  keep their behaviour and stay listed in SPEC: Confirm's credit to the decider, a stored value before a kept one,
  and `recheckRow`'s empty field. None touches a row of the messy sample. Rejected: putting each one to me now.

Reverse: taking a file off `exemptions` counts its places again, and they move onto a schema in the same commit.

### 2026-11-25 — the defaults sweep's lanes: what a literal `onNone` is, the cell's two keys, and `getOrThrow`

Question: the first Codex lanes (the access packages, the kernel and drivers, the catalog under the law's new kinds)
came back with the law at zero and the question still in the code: twelve `Result.getOrThrow(S.decodeResult(...))`
in the access packages (one a decode per character in the password compare), predicates turned into double
negations and sentences into schemas with a default, to get past `onNone: () => true` and `onNone: () => "the file"`.
And two plain optional keys, `Cell.shown` and `Cell.formula`, that the pilot left because the table crosses the
reader's worker.
Answer: I chose each; the agent recommended the same each time.

- A literal `onNone` is counted only where it stands in for data: a number, `""`, `[]`, `{}`, `null`, `undefined`.
  `true`, `false` and text that is not empty are a case said in words, and are left alone. Rejected: every literal
  counted (6 places in the catalog lane were rewritten to dodge it; 1 was left, `SheetLayout.rules.ts`, no sheet name
  reads "the file"); every literal counted and files exempted one by one.
- `Reading/Spreadsheet.rules.ts` goes on `exemptions` for absence: `Cell.shown` and `Cell.formula` stay keys left out
  (2 places, `{ type: "number", text: "123", shown: "00123" }`), because the table crosses the worker by
  `postMessage`, where an Option loses its prototype; `shownOf` and `formulaOf` read them as Options. Rejected:
  crossing the worker encoded, as upload chunks do; leaving them in the baseline.
- The law counts `Result.getOrThrow` and `Effect.runSync` in src folders, as a fallback. Rejected: leaving it to
  review. The count the question gave was wrong: no file of ours holds a `Result.getOrThrow`; the one in
  `packages/client/src/Http.runtime.ts` is `O.getOrThrow`, which the agent added to what is counted as the same
  escape, and `Effect.runSync` is in six files (8 places).
- Housekeeping: the seven merged `defaults` branches, local and on origin, and the worktrees `defaults-check` and
  `defaults-law` are removed. The `wf_*` worktrees stay: 26 of 27 hold uncommitted files and 4 hold commits not on
  main. The main checkout is on `main` again, and the sweep works only in worktrees.

Reverse: widening the literal list or taking the file off `exemptions` counts those places again, and they are
cleared in the same commit.

### 2026-11-26 — the defaults sweep's first edges: the byte readers, Better Auth's API and the browser's

Question: row 8 cleared 74 of 197 places in our csv and xlsx packages and stopped at the readers of bytes and markup:
92 places in 11 files under `csv/src/internal` and `xlsx/src/internal` (`bytes[i] ?? 0` in the UTF-8 scan of
`csv/src/internal/encoding.ts`). And three files hold places that are another library's API or the browser's.
Answer: I chose each; the agent recommended the same each time.

- The 11 reader files go on `exemptions` for the kinds each holds, with one reason: an Option for each byte, capture
  or position would cost the loop that reads every cell. Rejected: a rewrite with a benchmark (the pilot took a
  review from 1.2 s to 70 s with one fold); leaving them in the baseline. The other 31 places of those packages (the
  codec and schema files, two test supports) go back to a lane.
- `access/host/src/internal/authOptions.ts` (2, absence: Better Auth's session hook passes a null context and wants
  `undefined` back), `access/web/src/internal/authClient.ts` (2, a fallback and an absence: its answer's error is
  null or holds a message that may be left out) and `access/web/src/Session.atoms.ts` (2, absence:
  `typeof window === "undefined"`) go on `exemptions`. Rejected: only the Better Auth two; ruling on every edge at
  the end.
- A second dev server runs on port 5174 from the sweep's worktree, with its own local database, while the browser
  lanes merge; the messy sample is imported on it after each one.

Reverse: taking a file off `exemptions` counts its places again, and they are cleared in the same commit.

### 2026-11-26 — the defaults sweep's last edges: the browser's nulls, the reviewed cell's trims, a component's own props

Question: after the lanes for review, catalog/web, client and ui, three kinds of place are left that no schema can
take. About 50 read a null the browser hands back (Storage, `URLSearchParams`, Web Locks, DOM queries) in some 20
files (`text === null` after `localStorage.getItem` in `catalog/web/src/internal/storedWaiting.ts`). 15 trims in five
catalog/web files clean a cell of the file under review for display or a repair box (`row.file.name.trim()` in
`internal/WhyFlagged.tsx`). About 49 compare a component's own optional prop with `undefined` to choose markup
(`props.line === undefined` in `ui/src/PageHeader.component.tsx`).
Answer: I chose each; the agent recommended the same each time.

- The browser's nulls move into one small edge module a package, which reads the browser and returns Options; only
  those modules go on `exemptions`, for absence. A screen then holds none. Rejected: exempting each file as it is;
  leaving them in the baseline.
- `catalog/web/src/internal/CellForms.tsx` (5), `itemText.ts` (6), `WhyFlagged.tsx` (2), `cellDrafts.ts` (1) and
  `format.tsx` (1) go on `exemptions` for clean-ups only: each reads a reviewed cell, the case the rule of 2026-11-23
  keeps a reader for. Rejected: leaving them in the baseline.
- A component's check of its own optional prop stays counted in the baseline: the law cannot tell a prop from data
  without reading types, a counted place costs nothing, and a new one is still refused. Rejected: exempting the
  component files (their data checks would go uncounted too); teaching the law props.

Also, without a question: the law counts `.valueOrUndefined` as an unwrap, beside `O.getOrUndefined` and
`O.getOrNull`. A lane had cleared 69 test places by reading an Option's `valueOrUndefined` and asserting it defined,
which is the same unwrap under another name; the agent added it under "the law counts getOrThrow" (2026-11-25) and
the lane was redone.

Reverse: taking a file off `exemptions` counts its places again, and they are cleared in the same commit.

### 2026-11-26 — the review region's sparse cells: made total where rows enter

Question: about 100 places in the review region read a row's cell that may be missing, or start a counter
(`view.cells[column.id] ?? ""` in `review/src/internal/ReviewGrid.tsx`). A lane rewrote them with an Option a lookup
and measured it: drawing the grid for the 200-row sample went from 32.1 ms to 34.1 ms, the queue's context from
0.035 ms to 0.060 ms; told to revert anything measurably slower, it did.
Answer: I chose; the agent recommended the same. A row's cells are made a complete record for the region's columns
once, where rows enter the region, so a lookup cannot miss and no Option is made a cell. The lane shows the grid no
slower than today, or the places stay. Rejected: accepting the 6%; leaving the places counted.

Reverse: a row's cells go back to a sparse record and each lookup says its missing case.

### 2026-11-26 — a service method is dual on the record it acts on

Question: 24 methods of a `Context.Service` take two or more arguments (12 in `ImportStore`, for example
`history(organizationId, importId)`), none is dual, and the dual law reads only a parameter named `cause`, `error`,
`self` or `input`. Which argument is the one a method is dual on?
Answer: I chose; the agent recommended the same. The record acted on comes first and is `self`; the organization is
the setting: `history(importId, organizationId)` and `pipe(importId, store.history(organizationId))`. The nine methods
that start with `organizationId` swap their arguments. A check requires every method of a `Context.Service` with two
or more arguments to be dual. Rejected: one request value a method; the organization first.

Reverse: the methods go back to plain argument lists and the check to the four names.

### 2026-11-26 — a type assertion we need is written in one named helper

Question: 96 files are listed as allowed to write `x as T`, with no reason (348 assertions: the kit 133, the
registry's components 106, catalog/web 72, review 21, the rest 16). How is one we truly need marked?
Answer: I chose; the agent recommended the same. One function is the only place `as` is written in our own code:
`unsafeAssert<T>(value, "reason")`. Each use states its reason where it stands, a ledger lists each call with its
reason, and a new one fails the check until I approve the line. `x!` is refused outright (the same day). Rejected: a
list of files with reasons; zero with no exception.

Reverse: the list of files comes back.

### 2026-11-26 — the bans leave the registry's components as published

Question: do the readonly, assertion and Promise bans reach `packages/ui/src/components` and `hooks` (readonly 1,265
of 2,127 places, assertions 106, Promises 71)?
Answer: I chose; the agent recommended the same. They stay as published, in lists of their own, so an update from the
registry applies cleanly. Our own code goes to zero. Rejected: migrating them too.

Reverse: the components are held to the bans and each update from a registry is edited again.

### 2026-11-26 — the first five `unsafeAssert` calls are approved

Question: with the 124 type assertions gone from our own code, five claims are left that a library's types cannot
express, each written through `unsafeAssert` with its reason
(`packages/tooling/tool/cli/ledgers/unsafe-asserts.json`). Are they approved?
Answer: I approved all five; the agent proposed them. `apps/inventory/vite.config.ts` (the compression middleware's
types ask for Express's request where Vite's Connect supplies what it uses); `packages/catalog/web/test/support/catalog.ts`
(test stand-ins implement only the decoded response mode of the generated client's endpoints);
`packages/review/test/ReviewRegion.atoms.test.ts` (a partial DOM fixture for the virtualizer's frame); and two in
`packages/ui/src/ListTable.component.tsx` (a scoped atom and React context erase the table's row generic).

Reverse: a call is taken out and its ledger line with it; the ledger only shrinks without a new approval.

### 2026-11-26 — Better Auth: Alchemy's package at move 2, the driver stays the seam, and its Promises go to the driver's edge

Read first: Better Auth's Effect integration (https://better-auth.com/docs/integrations/effect) is a page, not a
package. It mounts `auth.handler` with `HttpEffect.fromWebHandler` and wraps `auth.api.getSession` in
`Effect.tryPromise`; `@beep/better-auth` already does both, with typed errors, spans, a decoded session and the
cross-site guard. Nothing is adopted from it. `@alchemy.run/better-auth` (https://alchemy.run/better-auth/) gives the
server as Effects (`BetterAuth(options)`, `auth.fetch`, `auth.getSession()`, `auth.api.*`), the database as a Layer, a
minted secret and migrations at deploy; it needs Alchemy's runtime and is not in `vendor/alchemy`. Neither has a
browser client, and neither changes Better Auth's hooks, which return Promises. Read from the documents; the package
was not installed or compiled.

1. **When is `@alchemy.run/better-auth` adopted?** I chose; the agent recommended the same. At move 2 of
   `explorations/alchemy-domain`, when the Worker becomes an Alchemy `Cloudflare.Worker` and the pin widens. Infra I3
   stands: the tables stay a migration written by hand (`migrate: false`). Rejected: now, ahead of the domain work;
   never.
2. **What becomes of `@beep/better-auth` then?** I chose; the agent recommended the same. Its service keeps its shape
   (`handle`, `session`, `publicOrigin`, `route`) and is built on Alchemy's `BetterAuth` instead of `betterAuth()`, so
   `@inventory/access-host` and its tests do not change. Rejected: deleting the driver; deciding at move 2.
3. **The browser's `better-auth/client` calls** (`SignIn.screen.tsx`, `Session.atoms.ts`, `AppSidebar.tsx`,
   `SignedIn.tsx`)? I chose; the agent recommended the same. One module in `@beep/better-auth` wraps the client and
   gives sign-in, sign-up, sign-out, a new organization and the active organization as Effects with a typed refusal;
   a screen writes no Promise. Rejected: our own `HttpClient` calls to `/api/auth/*`; leaving them.
4. **The hooks in `authOptions.ts`** (seven Promise sites)? I chose; the agent recommended the same. Each hook is an
   Effect with a typed refusal, and one helper in `@beep/better-auth` turns it into the Promise Better Auth asks for.
   Rejected: leaving them as a recorded exception; waiting for Alchemy's package.

Next: 3 and 4 are work for now, schema and contract of the driver's client first; 1 and 2 wait for move 2. Not built.

Reverse: 1, the brief's move 2 names the driver for the session lookup instead; 2, the host imports Alchemy's package
and the driver is deleted; 3 and 4, the screens and `authOptions.ts` call Better Auth as before and the ledger's
counts for them stay.

### 2026-11-26 — the defaults law's last edges: own props, one storage twin, an adapter per library

Asked by dialog once two lanes had brought the baseline to 104 places in 30 files and listed what would not move.

1. **A React component checking its own optional prop in its body** (`props.line === undefined`, 34 places)? I
   chose; the agent recommended the same. The law stops counting it. `??` in a body stays refused. Rejected: each
   component file on the exemptions list; the props made required Options, which reverses 2026-11-23.
2. **The tests' stand-in for the browser's storage** (`kept[key] ?? null`, 10 places in 8 test files)? I chose; the
   agent recommended the same. One shared file that every one of them imports, and that file on the exemptions
   list. Rejected: the eight files listed as they are; leaving them counted.
3. **Another library handing back nothing** (the table, the virtual list, an atom's first read of itself, a portal
   target, the Web Locks default: about 17 places in 5 files)? I chose; the agent recommended the same. Each behind
   a small adapter file of ours that gives an Option, and only those files exempted, so the grid's own files end at
   none. Rejected: the five files listed; leaving them counted.
4. **`ImportStore.listOpen` and `listPast`**? I chose; the agent recommended the same. One named query,
   `{ organizationId, limit }`, not dual: a list has no value it acts on. Rejected: the organization first and
   dual; the limit first, as merged.

Next: a lane builds 1 to 3 (`goals/defaults-closeout`, step 7b); 4 is on main.

Reverse: 1, the law counts the checks again and the files go back into the baseline; 2 and 3, the stand-in and the
adapters are inlined and their files leave the list; 4, the two methods take two arguments again.

### 2026-11-26 — the defaults baseline's last four places, and the starting values the last lane kept

Asked by dialog once the lane of step 7b (`goals/defaults-closeout`) had brought the baseline to 4 places in 4 files.

1. **The three public APIs that run `Effect.runSync`** (`stringify` in `packages/ui/src/Json.codec.ts`, the one
   Reactivity in `packages/client/src/Api.atoms.ts`, the workbook writer in
   `packages/foundation/modeling/xlsx/src/Xlsx.codec.ts`)? I chose; the agent recommended the same. The three files
   on the exemptions list, each as the synchronous edge a caller outside Effect needs. Rejected: making them
   Effects, which changes `stringify`'s and the writer's signatures and their callers on screens; leaving them
   counted.
2. **`TotalCells.text`, which reads a column outside the region's declared columns as empty text** (1 place)? I
   chose; the agent recommended the same. It returns an Option and the screen decides at its last step. No saved
   progress changes. Rejected: exempting `ReviewDraft.rules.ts` for the one fallback; leaving it counted.
3. **Four starting values nobody had ruled on**, each now on a schema: a count starts at 0 (`CountStart`), a new
   facet group has 0 rows and no spellings (`FacetStart`), and in test support only a pending tab handle is ""
   (`TabIdentity`) and an unrecorded writer is "somebody else" (`WriterStart`)? I chose; the agent recommended the
   same. All four ratified as they were. Rejected: the two test values made Options in a follow-up.

Next: 1 and 2 are built on the branch of step 7b; the baseline then names no file.

Reverse: 1, the three files leave the list and are counted again; 2, the reader returns text with `""` for a column
it does not hold; 3, the value moves or becomes an Option on its schema.

### 2026-11-26 — CI speed: the split, the seeds, the cache and the run counts

Asked from the audit of `turbo.json`, the workflows, the tests and the checks
([goals/ci-speed/AUDIT.md](../../goals/ci-speed/AUDIT.md)): a run is about 11 minutes, its check job replays nothing
and carries everything on two slots.

1. **The two required check names when the jobs are split?** I chose; the agent recommended the same. "Check, test and
   build" and "Proofs and search of the model" stay as jobs that wait for their parts and fail when one does; the
   ruleset and the GitHub stack are untouched, and a job can be added without a deploy. Rejected: requiring each part
   by name in `GitHub.stack.ts`.
2. **The 8 recorded seeds of `Draft.machine.test.ts`, each at 1,000 runs?** I chose; the agent recommended the same.
   Each seed's failing ordering is recovered against the code before its fix and pinned beside the orderings already
   pinned, and runs once. The 4 unseeded properties keep 1,000 runs. Rejected: keeping the seeds at 1,000 and only
   splitting the file; the seeds at 1,000 nightly.
3. **Where the check's turbo results are kept between runs?** I chose against the recommendation. beep-effect's cache
   Worker from the start, this repository as a team of its own; pull requests read, only main writes. The agent
   recommended `actions/cache` first, as the proofs job does, and the Worker later. Rejected: `actions/cache` only.
4. **Property run counts on a pull request?** I chose; the agent recommended the same. One variable; fewer runs on a
   pull request (500 for `WaitedRows.property`, 2,000 today), today's counts every night, and the variable named in
   each task's `env` so a result made at one count never replays at another. Rejected: today's counts everywhere;
   more than today's every night.

Reverse: 1, the parts are named in the stack and I deploy it; 2, the seed loop comes back; 3, the `TURBO_*` settings
come out of the workflow and a cache step takes their place; 4, the variable is removed and the counts are literals
again.

### 2026-11-26 — CI speed: who writes to the cache, where its settings live, main's runs and the largest save

The second round, after the cache Worker was chosen.

1. **Who besides CI holds a token for this repository's team?** I chose against the recommendation. The workstation
   writes too, as beep-effect's `dankstation` principal does there: what a local run made, CI may replay. The agent
   recommended a read token only, because a local build stores `.dev.vars` in its output today and no environment is
   hashed. Rejected: CI only. What this asks of the configuration before the token exists is the next entry.
2. **Where the cache's settings live?** I chose; the agent recommended the same. In `packages/infra/src/GitHub.stack.ts`
   beside the deploy environments: the variables, the read and write tokens from 1Password references, and an
   environment for the write token limited to main. I copy the tokens into 1Password and deploy the stack. Rejected:
   by hand in the repository's settings.
3. **Does a push to main cancel a run in progress on main?** I chose; the agent recommended the same. No: every run
   that starts finishes and writes its results. Looked at again only if bursts still queue after the split.
   Rejected: cancelling on main.
4. **Where `WriteLimits.slow.test.ts` runs?** I chose; the agent recommended the same. On every pull request, at
   50,000 rows. Rejected: nightly only; 5,000 rows on a pull request.

Reverse: 1, the workstation's principal is made read-only in beep-effect's policy and its token rotated; 2, the
declarations come out of the stack; 3, `cancel-in-progress` is true for main; 4, the suite moves to the nightly.

### 2026-11-26 — CI speed: what a shared cache asks, now that the workstation writes

The third round: the conditions under which a result made on my machine may count on CI.

1. **Where CI runs things for real, whatever the cache holds?** I chose; the agent recommended the same. A pull
   request replays anything, my machine's results included. The push to main runs the check job's tasks (type-check,
   lint, tests, slow tests, build) with `--force` and writes its own results over them, so a difference between my
   machine and CI turns main red at the merge. The proofs replay on main too and are forced every night, as now.
   Rejected: replaying everywhere; a second team so pull requests replay only what main's CI tested.
2. **The environment?** I chose; the agent recommended the same. `envMode` strict: a task names in `env` what changes
   its result, a pass-through list names what it needs and that changes nothing, and a variable nobody listed is not
   seen by the task. This replaces the 2026 choice of loose mode made for workerd and wrangler; the list is found by
   running `check:full` until it passes. Rejected: loose with `env` lists.
3. **The proofs' results?** I chose; the agent recommended the same. On the Worker with everything else: the
   `actions/cache` steps and the key step leave the proofs job, a proof I ran locally replays on the pull request,
   and the nightly keeps `--force` and every mutant. The lock is unchanged. Rejected: `actions/cache` for the proofs
   alone.

Reverse: 1, `--force` comes off main's run; 2, `envMode` is loose again and the lists stay as documentation; 3, the
cache steps return to the proofs job and its turbo call names a local cache folder.
