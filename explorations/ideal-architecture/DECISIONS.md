---
type: Decisions
title: Decisions
description: Ideal architecture decisions: open questions in the order they block work, and the answered ones with how to reverse them.
---

# Decisions

Open decisions are listed first, in the order they block work. Each names the report section that argues it.
Answered decisions move below with the date, the answer and how to reverse it.

## Open

### Round two: packages and the client

| # | Question | Recommendation | Source |
| --- | --- | --- | --- |
| 11 | Where is `Model.Class` used? | Stored-row schemas in host packages only | 01 §8, 03 §7.2 |
| 12 | `Option`/`DateTime` fields or `null`/strings? | `DateTime` for timestamps only | 03 §7.2 |

### Round three: the model path

| # | Question | Recommendation | Source |
| --- | --- | --- | --- |
| 13 | A second vendor for confidence scores? | Not until a labelled calibration run shows a gain | 03 §7.3 |
| 14 | Retry a bad structured answer? | Never; fall to the rules | 03 §7.4 |
| 15 | Do model-preselected values count as Ready? | No | 03 §7.8 |
| 16 | MCP for agents? | Own tools: reads plus proposal-only writes that need approval | 01 §3 |
| 17 | Pinning of unstable Effect modules? | Exact pins, one version, tests on the next minor before upgrading | 03 §7.6 |

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
