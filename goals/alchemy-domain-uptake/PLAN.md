---
type: Plan
title: "Alchemy domain uptake, plan"
description: "The steps of the Alchemy domain uptake goal, one per move of the brief, the inventory items each holds, their status, the current blocker and what Benjamin does by hand."
from: explorations/alchemy-domain
---


# Plan

[SPEC](SPEC.md) holds the objective and acceptance; [INVENTORY](INVENTORY.md) holds every item. Status is one of `todo`, `doing`, `done`, `closed` (tried, did not hold up, with the reason). The packet was written on 2026-11-26 and the brief signed the same day.

A step is one move of [the brief](../../explorations/alchemy-domain/BRIEF.md). An item is built by the `domain` agent, one item to a brief, schema first, and its **Fails without it** is the check that closes it. A move's open decisions (42 to 56, 60 to 62 and 21a) are put to Benjamin when the move opens, never before.

| # | Move | Items | Sizes | Needs first | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | 1: the review's model, in memory (built, on main) | 8: catalog-01, tests-01, tests-02, tests-03, tests-04, tests-05, tests-06, tests-07 | 7 S, 1 M | his signature on the brief, or his word that the item counts as part of the model on main | done |
| 2 | 2: the host and the first slice: the model's Worker, the session, the allowance | 37: access-01, access-02, access-03, access-04, host-01, host-02, host-03, host-04, host-05, host-06, host-07, host-08, host-09, host-10, host-11, host-12, host-13, tests-08, tests-09, tests-10, tests-11, tests-12, tests-13, tests-14, usage-01, usage-02, usage-03, usage-04, usage-05, web-01, web-02, web-03, web-04, web-05, web-06, web-07, web-08 | 14 S, 17 M, 5 L, 1 XL | his signature; the pin widened to `@alchemy.run/better-auth` and `@alchemy.run/test` (his re-pin) | todo |
| 3 | 3: the import's write side: stage, acts, confirm, take-back, `DraftRows`, `Item` and its saga | 72: access-05, catalog-02, catalog-03, catalog-04, catalog-05, catalog-06, catalog-07, catalog-08, catalog-09, catalog-10, catalog-11, catalog-12, catalog-13, catalog-14, catalog-15, catalog-16, catalog-17, catalog-18, catalog-19, catalog-20, catalog-21, catalog-22, catalog-23, catalog-24, catalog-25, catalog-26, catalog-27, catalog-28, catalog-29, catalog-30, host-14, host-15, host-16, host-17, host-18, host-19, host-20, host-21, host-22, host-23, tests-15, tests-16, tests-17, tests-18, tests-19, tests-20, tests-21, tests-22, tests-23, tests-24, tests-25, tests-26, web-09, web-10, web-11, web-12, web-13, web-14, web-15, web-16, web-17, web-18, web-19, web-20, web-21, web-22, web-23, web-24, web-25, web-26, web-27, web-28 | 11 S, 32 M, 23 L, 6 XL | move 2; the move's open decisions; a test stage he deploys | todo |
| 4 | 4: the Items page as queries, `EditItem` as a command | 12: catalog-31, catalog-32, catalog-33, catalog-34, host-24, tests-27, tests-28, tests-29, web-29, web-30, web-31, web-32 | 2 S, 7 M, 3 L | move 3 | todo |
| 5 | 5: the rest of the import: `Upload`, suggestions as a saga, the lists, `ImportHistory` | 20: catalog-35, catalog-36, catalog-37, catalog-38, catalog-39, catalog-40, catalog-41, catalog-42, catalog-43, catalog-44, host-25, host-26, tests-30, tests-31, tests-32, usage-06, usage-07, web-33, web-34, web-35 | 6 S, 11 M, 2 L, 1 XL | move 3; a stage he deploys with imports confirmed since move 3 | todo |
| 6 | 6: people: `Organization`, `Member`, `MemberEmail`, `AdminApi` | 34: access-06, access-07, access-08, access-09, access-10, access-11, access-12, access-13, access-14, access-15, access-16, access-17, access-18, access-19, access-20, access-21, access-22, access-23, access-24, host-27, host-28, host-29, host-30, ops-01, ops-02, tests-33, tests-34, tests-35, tests-36, web-36, web-37, web-38, web-39, web-40 | 7 S, 19 M, 6 L, 2 XL | move 3; decision 21a | todo |
| 7 | 7: cluster: `Usage` on the pool, its cron and singleton, the admin's live page | 5: host-31, ops-03, tests-37, usage-08, usage-09 | 2 S, 1 M, 1 L, 1 XL | move 2; decision 27; the pin widened to `@alchemy.run/effect-cluster` | todo |
| 8 | 8: mail, the channel, Discord sign-in, scores, the suggestions' object | 9: access-25, access-26, access-27, catalog-45, catalog-46, catalog-47, host-32, usage-10, web-41 | 2 S, 5 M, 2 L | move 6; decisions 23 and 60 to 62 | todo |
| 9 | 9: the operator's surface: CLI, HTTP document, tools, MCP, analytics | 10: host-33, ops-04, ops-05, ops-06, ops-07, ops-08, ops-09, tests-38, usage-11, web-42 | 5 S, 4 M, 1 L | moves 3 and 6; decisions 50 and 54 | todo |
| 10 | 10: the history and the mirror | 2: host-34, ops-10 | 2 XL | move 9; decision 55 | todo |
| 11 | none: against an answered decision, or no move | 12: catalog-48, host-35, ops-11, ops-12, ops-13, tests-39, tests-40, tests-41, tests-42, usage-12, usage-13, web-43 | 3 S, 8 M, 1 L | a new decision of his for nine of them; nothing for tests-40, tests-41 and tests-42 (scratchpad tooling) | todo |

## Build first

Three items need nothing but his word that they count as part of the model already on main: each is small, touches no screen and changes no sentence a person reads.

1. **tests-01** (S): A test that fails on a command or a refusal no story names.
1. **tests-02** (S): A test that fails on a served declaration with no description.
1. **catalog-01** (S): A rule that a row's change, and the change its last undo took back, are ones its import gave.

Three more need nothing at all, being tooling of the scratchpad: **tests-40**, **tests-41** and **tests-42**.

## Done

- **tests-01** `done`: `packages/catalog/model/test/StoryCoverage.test.ts`; fails naming `HistoryEnds` with its story taken out, and a command and a rejection added with no story (its own cases). The comment table in `Review.story.test.ts` is gone.
- **tests-02** `done`: `packages/catalog/model/test/Annotations.test.ts`, which walks `CatalogApi.serves`; a trial Api over a trial view shows it names a silent view and a silent Api. The two cases moved from `ReviewModel.property.test.ts`.
- **catalog-01** `done`: `Catalog.ARowsChangeIsOneItsImportGave`, a model invariant (searched, not proved); `verify` passes with the lock updated once by `UPDATE_VERIFY_LOCK=1`. No mutant was written for it (it is not a check of a `decide`).
- **tests-03** `done`: `test/Group.prove.test.ts` proves the group under the two decisions that record on it (1.4 s); `test/Row.prove.test.ts` holds the row's starting state and its fold only (0.1 s). The row under its two decisions is not proved a second time there: that took about three minutes and the two decisions' own proofs already hold it. One helper, `aggregateFailures` in `test/proving.ts`, names every rule not proved; the import's proof uses it too.
- **tests-04** `done`: `test/Catalog.explore.test.ts` in an `explore` project: depth 3, 5,000 walks, a seed from the day (or `EXPLORE_SEED`). 364 s on the workstation, passed. Its own job in `.github/workflows/proofs-nightly.yml`, and the fifth task of `bun run proofs:nightly`. Not measured on the nightly's runner.
- **tests-05** `done`: `test/Tutorial.test.ts`. Part 1 is a story on `Import`; parts 2 and 3 are written as tests expected to fail (`it.effect.fails`) until the model declares a view and a policy, so they turn red the day one lands and are then rewritten on it. His to change if he wants them red from today.
- **tests-06** `done`: `bun run beep laws block-files` (`block-files:check`, in the three checks). Renamed: the five contract `*.command.ts` to `*.payload.ts` (the access contract's subpath `./PeopleCommand` is now `./PeoplePayload`), the two hand-written ports to `*.port.ts` (their service keys follow the path), `Session` into `Actor/Session.middleware.ts`, `CatalogApi` into `Catalog.api.ts`. The proofs pass with the path counts unchanged (Deciding 152, Undoing 138, DecidingGroup 22, UndoingGroup 38) and Verify passes with the lock untouched. On his word the same day ("Hold all kinds") the law holds every kind to its file, and a contract package declares no block outside its reserved endings.
- **tests-07** `done`: `bun run beep laws model-inputs` (`model-inputs:check`): for `prove`, `verify`, `mutants` and `mutants:sample`, every file reached from the model's blocks and from the code files the task's own inputs read is in that task's inputs, or the law names the glob. The inputs in `packages/catalog/model/turbo.json` list every block ending; No rule file is an input: `Review/ItemsOfRow.context.ts`, a handler's default that imports five of them, is `ItemsOfRow.reference.ts` on his word ("Rename the context"), so an edit to a rule runs no proof again.

## Current blocker

None for move 1. He signed the brief on 2026-11-26 ("I've approved", the exploration's DECISIONS). Move 2 is open. The pin holds `@alchemy.run/better-auth` since his re-pin of 2026-11-26 (`@alchemy.run/test` is npm's build, which the registry never makes). Four of the move's decisions are answered (the exploration's DECISIONS, "Move 2 opens"); the rest are put to him in rounds, and what none of them blocks is built meanwhile.

## What Benjamin does by hand

- Signed the brief on 2026-11-26.
- Answers each move's open decisions when it opens.
- Decides nine of the items under `none` (catalog-48, host-35, ops-11, ops-12, ops-13, tests-39, usage-12, usage-13, web-43): each goes against a decision he answered (25, 26, 38, 39) or asks a new one, and stays `todo` until he decides it or closes it.
- Hosting: every deploy of the model's Worker and the Durable Objects (moves 2, 3 and 7) is his, as in [infra](../infra/PLAN.md).

## Not verified

40 items came from the critic's gaps, and their verifiers did not run: tests-05, tests-06, tests-07, host-09, host-10, host-11, host-12, host-13, tests-14, usage-05, web-08, catalog-29, catalog-30, host-21, host-22, host-23, tests-20, tests-21, tests-22, tests-23, tests-24, tests-25, tests-26, host-26, tests-31, tests-32, access-22, access-23, access-24, tests-35, tests-36, access-27, catalog-47, host-32, web-41, host-33, ops-08, ops-09, tests-38, host-34. Each is read against the code before its brief is written.
