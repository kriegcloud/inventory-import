---
type: Decisions
title: Decisions
description: Alchemy domain decisions. The open questions the research raised, in the order they block the brief, and the answered ones with how to reverse them.
---

# Decisions

Open questions are listed first, in the order they block work. Each names the page that argues it. They are put to
Benjamin by the brief, one at a time, with options; nothing below is decided until he answers. Answered decisions
move under "Answered" with the date, the answer and how to reverse it.

## Open

| # | Question | Where it is argued |
| --- | --- | --- |
| 1 | How does the app take what exists only on the library's `main` (`Decision`, `Relation`, invariants and transitions, `Verify`, commands without `target`): the next release that has it, or a pinned build from `main`? | [02 merged since beta.87](research/02-merged-since-beta-87.md), [04 trial](research/04-trial.md) |
| 2 | What are Confirm and take-back in the new model, and what does the person see if one stops halfway? An aggregate's commit and a D1 batch cannot be one transaction. | [projection](research/concepts/projection.md), [decision](research/concepts/decision.md), [host on Cloudflare](research/concepts/host-cloudflare.md) |
| 3 | Where do an aggregate's commands, events and rejections live? The prover follows relative imports only, so it cannot read blocks that the `model` package imports from the `contract` package by name. | [project layout](research/concepts/project-layout.md), [prove](research/concepts/prove.md), [04 trial](research/04-trial.md) |
| 4 | Does the rule "schema classes are built with `.make`" get an exception for domain blocks? The prover reads `new Event(...)` and not `Event.make(...)`. | [prove](research/concepts/prove.md), [event](research/concepts/event.md), [rejection](research/concepts/rejection.md) |
| 5 | Where does the model run? The Cloudflare host needs an Effect-native Worker, and the app's Worker is a plain module built with the screens: a second Worker beside it behind a service binding, or one Effect-native Worker that also serves the API and the screens. | [host on Cloudflare](research/concepts/host-cloudflare.md), [platform contract](research/concepts/platform-contract.md) |
| 6 | What answers the Items page's paging, sorting, filtering and search? A paged query answers entries and a cursor, with no total and no page number. | [query](research/concepts/query.md) |
| 7 | How do the rows already in D1 arrive in the new model? | [backfill](research/concepts/backfill.md), [projection](research/concepts/projection.md) |
| 8 | Is every item its own aggregate, or a row a projection writes? | [host on Cloudflare](research/concepts/host-cloudflare.md), [unique values](research/concepts/unique-values.md) |
| 9 | Which of the extras he asked for are built as he pictured them, and which in the nearest form that works (a GraphQL surface, confidence scores, Cluster, Alchemy Git)? | [graphql](research/concepts/graphql.md), [confidence scores](research/concepts/confidence-scores.md), [cluster](research/concepts/cluster.md), [Alchemy Git](research/concepts/alchemy-git.md) |
| 10 | Inside a `decide` or a handler the engine already opens a span. Does the rule "a named `Effect.fn` for every Effect function" hold there? | [observability](research/concepts/observability.md) |
| 11 | In what order do the moves happen, so that each leaves the app working? | the brief |

## Answered

### 2026-11-19 — the packet

Question: where does the material on `@alchemy.run/domain` live, and what is it for? Answer: its own exploration
packet in the repository, beside `ideal-architecture`, for agents to reference and possibly to become agent skills
later; the app is where he explores the library in full before porting beep-effect to it. His words are in
[CAPTURE.md](CAPTURE.md). Rejected: one long research report inside `ideal-architecture`. Reverse: move the pages; the
concept pages are written to be lifted into a skill's `references/` folder unchanged.

### 2026-11-19 — use, not borrow

Question: does the app use the library, or take its ideas? Answer: "Not borrow use.", and "if possible find a way to
make use of ever single thing". The default for every concept is to use it; "cannot yet" needs the exact blocker and
what removes it. This reverses the 2026-11-18 decision "core" in
[ideal-architecture](../ideal-architecture/DECISIONS.md); the reversal is written into that file in the same commit
as the brief. Reverse: a new decision by him.
