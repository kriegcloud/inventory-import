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
| 0 | The packet; `emptyWhenLeftOut` in `@inventory/kernel/Wire` | — | this session | doing |
| 1 | `packages/catalog/contract` (src and tests) | 41 | this session, by hand | todo |
| 2 | `packages/catalog/model` (src and tests) | 347 | this session, by hand | todo |
| 3 | `packages/catalog/host` | 20 | this session, by hand | todo |
| 4 | Agent files, `CLAUDE.md`, the skills README, `docs/patterns.md` and `docs/kit.md` examples | — | this session | todo |
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

None for the contract and host. Two questions wait on Benjamin (SPEC, "Open questions"); the cell-reading parts of the
model wait on them, and everything else proceeds.

## Choices made along the way

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

## Evidence

- beep-effect lints study, 2026-11-23, at beep-effect `92be3a06`: read by a Codex lane from source, each claim with
  file and line; summarised in SPEC, "What beep-effect's lints cover". Kept outside the repository (it quotes
  beep-effect paths at length) in the session's `.scratch/defaults/port-study.md`.
- `typescript/no-unnecessary-condition`, type-aware, run on the catalog's contract, model and host: one finding,
  `model/src/Suggestion/Suggest.rules.ts:147`.
