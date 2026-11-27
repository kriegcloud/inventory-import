---
type: Goal
title: "Alchemy domain uptake"
description: "Use as close to all of @alchemy.run/domain as the app allows: 221 places, found by the domain agent's sweep at e1c3e6d, where a block of the library (views, queries, projections, streams, policies, sagas, external systems, served Apis, hosts, Vault, the operator's tools) replaces or adds to hand-written code, each built or closed with its reason."
status: active
from: explorations/alchemy-domain
---

# Alchemy domain uptake

Benjamin asked, on 2026-11-26, whether the app uses `Domain.View`, `Query`, `Projection`, `Stream`, `Policy`,
`ExternalSystem` and `Api`, and any other block of `@alchemy.run/domain` it could. It uses Aggregate, Command, Event,
Rejection, Decision, Relation, Model, RequestContext, Prove, Story, Verify and the lock, in
`packages/catalog/model`, in memory, and nothing else. His goal, in his words: "Complete refactors or rewrites of
existing modules or entire packages is warranted. Our goal is to use as close to 100% of the libraries concepts,
abstractions & and patterns as possible". He made one exception: "No need for foldkit"
([DECISIONS](../../explorations/alchemy-domain/DECISIONS.md), 2026-11-26).

The `domain` agent ([.claude/agents/domain.md](../../.claude/agents/domain.md), on Fable 5.2 medium, written from
[research 08](../../explorations/alchemy-domain/research/08-the-library-at-e1c3e6d.md)) swept the repository and
found 221 places. They are in [INVENTORY](INVENTORY.md), one item each, ordered by the brief's moves in
[PLAN](PLAN.md).

## Objective

Every item in the inventory is either **built**, with its **Fails without it** check passing in `bun run check` or
`check:full`, or **closed**, with the reason it did not hold up when tried or the decision of his that ruled it out.
When the last one is settled, every block of the library but Foldkit is in use here or listed under "Blocks with no
use here" with a reason that still holds.

## Non-goals

- **Foldkit.** His answer of 2026-11-26. The admin page that watches the allowance is a React screen on atoms.
- **A second design.** [The brief](../../explorations/alchemy-domain/BRIEF.md) is the design and its order of moves
  is this goal's order. An item that disagrees with the brief is a question for him, never a quiet change to it.
- **Hosting by an agent.** Every deploy of the model's Worker, its Durable Objects and the cluster is his
  ([infra](../infra/PLAN.md), "What Benjamin does by hand").
- **Carrying stored rows over.** Decision 37: each move starts empty, with `bun run db:reset` locally.

## Constraints

- **Answered decisions bind.** Decisions 1 to 40 (all but 21a) and the Foldkit answer are binding as written in the
  exploration's `DECISIONS.md`. The nine items that go against one wait for a new decision of his.
- **The brief is signed** (2026-11-26, "I've approved"): a Build brief names this goal, as
  `.claude/agents/domain.md`, "What binds you", asks.
- **Open decisions are asked when their move opens** (42 to 56, 60 to 62, 21a), through `AskUserQuestion`, and
  written down at once.
- **One item to a brief**, built by the `domain` agent, schema first, then the contract, then the code. An item
  marked _not verified_ is read against the code before its brief is written.
- **No sentence a person reads changes** without his decision. The import's outcomes, counts and take-back still meet
  the import rules in `CLAUDE.md`, and the messy sample still stores 155 items.
- **The model's proofs stay proved.** A rule changed on purpose updates the lock once with `UPDATE_VERIFY_LOCK=1`,
  in the commit that changes it.

## Acceptance

- [ ] Every item in [INVENTORY](INVENTORY.md) has a status in [PLAN](PLAN.md): `done` with its check named, or
      `closed` with its reason.
- [ ] `bun run check` and `bun run check:full` pass after each move.
- [ ] `bun run --cwd packages/catalog/model verify` passes, with the lock committed.
- [ ] The messy sample imported through Confirm on a fresh database stores 155 items, and the Result step, the Items
      table and the stored rows agree, seen on screen after moves 3, 4 and 5.
- [ ] Every block the library exports at the pinned commit, Foldkit apart, is imported somewhere in `packages/` or
      `apps/`, or listed under "Blocks with no use here" with a reason that still holds.
- [ ] `bun run docs:check` passes.

## Decisions

- 2026-11-26: Foldkit is not used ("No need for foldkit").
- 2026-11-26: the brief is signed ("I've approved").
- The rest are the exploration's [DECISIONS](../../explorations/alchemy-domain/DECISIONS.md).
