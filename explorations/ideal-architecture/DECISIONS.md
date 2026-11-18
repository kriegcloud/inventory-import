# Decisions

Open decisions are listed first, in the order they block work. Each names the report section that argues it.
Answered decisions move below with the date, the answer and how to reverse it.

## Open

### Round two: packages and the client

| # | Question | Recommendation | Source |
| --- | --- | --- | --- |
| 5 | Atoms or TanStack Query? | Keep TanStack Query now; atoms as a later change | 03 §7.1 |
| 6 | Filename postfixes and exports in foundation packages? | Role suffix in every filename outside `internal/`; exact exports, no `./internal/*` | 04 §9.4, §9.5 |
| 7 | Byte-lossless CSV document in the first version? | No: canonical table codec first | 04 §9.7 |
| 8 | Drop SheetJS and papaparse? | Yes, each behind fixture parity | 04 §9.8 |
| 9 | Lenient or strict CSV by default? | Lenient for reading; strict as an option | 04 §9.16 |
| 10 | Effect diagnostics adoption? | Staged: strict for new packages, fix on move, vendored ui excluded | 04 §9.10 |
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
| 25 | Rename placeholder names, cookie included? | Yes, before the first deploy | 02 §10.10, 04 §9.13 |
| 26 | Where do `explorations/` and `goals/` live? | Repository root, checked by `docs:check` | 04 §9.11 |

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
