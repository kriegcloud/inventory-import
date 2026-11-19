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

### 2026-11-18 — client state

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
