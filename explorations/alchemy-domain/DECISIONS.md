---
type: Decisions
title: Decisions
description: Alchemy domain decisions. The open questions the research raised, in the order they block the brief, and the answered ones with how to reverse them.
---

# Decisions

Open questions are listed first, with the numbers [the brief](BRIEF.md) gives them. Each is put to Benjamin with its
options, the recommended one first; nothing below is decided until he answers. Answered decisions move under
"Answered" with the date, the answer and how to reverse it.

## Open

| # | Question | Recommended in the brief | Where it is argued |
| --- | --- | --- | --- |
| 1 | Where do review decisions live: one instance per import, one per row, or both? | One instance per import | [07 the review-decisions trial](research/07-review-decisions-trial.md) |
| 2 | What does a person see when someone else decided the row they are deciding? | Theirs is not applied to that row; they see the other's decision and decide again | [07](research/07-review-decisions-trial.md), section 3 |
| 3 | What does an undo do to a row someone else changed since? | It takes back the rows still as the step left them, and says which it left | [07](research/07-review-decisions-trial.md), sections 3 and 4 |
| 4 | How does the app take what exists only on the library's `main` (`Decision`, `Relation`, invariants and transitions, `Verify`, commands without `target`)? | Pin the preview build of one `main` commit, for every Alchemy package together | [02 merged since beta.87](research/02-merged-since-beta-87.md), [07](research/07-review-decisions-trial.md), "How it was run" |
| 5 | What do Confirm and a take-back become, and what does the person see if one stops halfway? Is every item its own instance? | The event names a plan staged in D1; one projection writes the items in one batch | [projection](research/concepts/projection.md), [decision](research/concepts/decision.md), [host on Cloudflare](research/concepts/host-cloudflare.md) |
| 6 | Where do an aggregate's commands, events and rejections live? The prover follows relative imports only. | In the context's `model` package, one folder per aggregate | [project layout](research/concepts/project-layout.md), [prove](research/concepts/prove.md) |
| 7 | Are domain blocks built with `new`? The prover reads `new Event(...)` and not `Event.make(...)`. | `new` in files that hold a `decide`, with the diagnostic off for that file | [prove](research/concepts/prove.md), [event](research/concepts/event.md) |
| 8 | Does a handler the engine runs keep a named `Effect.fn`? | No: the engine names the span | [observability](research/concepts/observability.md) |
| 9 | Where does the model run: a second Effect-native Worker beside the site's, or one that also serves the API and the screens? | A second Worker, reached by a service binding | [host on Cloudflare](research/concepts/host-cloudflare.md) |
| 10 | What answers the Items page's paging, sorting, filtering and search? | A query that answers today's page | [query](research/concepts/query.md) |
| 11 | How do the rows already in D1 arrive in the model? | Adopt at first touch | [backfill](research/concepts/backfill.md), [projection](research/concepts/projection.md) |
| 12 | In what order do the moves happen? | The review's decisions first | the brief, "Order of moves" |
| 13 | Which model runs on which host? | `Catalog` on Durable Objects, `Access` on Effect Cluster's pool | [cluster](research/concepts/cluster.md), [host on Effect Cluster](research/concepts/host-effect-cluster.md) |
| 14 | What is GraphQL used for? | A client of Cloudflare's analytics, in the operator's command line | [graphql](research/concepts/graphql.md) |
| 15 | What do confidence scores decide? | The closed questions themselves, behind a `Decider` port | [confidence scores](research/concepts/confidence-scores.md) |
| 16 | Which mails does the app send? | The three a person is stuck without, then the two notices | [Resend](research/concepts/resend.md) |

The packet first listed eleven questions. They became these: 1 is now 4; 2 and 8 are 5; 3 is 6; 4 is 7; 5 is 9; 6 is
10; 7 is 11; 9 is 13 to 16; 10 is 8; 11 is 12. Questions 1 to 3 are new, from the trial on saving review decisions.

Not in this list: the four small choices of Discord sign-in, asked when that move starts
([Discord sign-in](research/concepts/discord-sign-in.md)). Two questions on today's contract (what Confirm does when
the screen is behind the draft, and whether a save's answer says that it changed nothing) were answered on
2026-11-19 and are under "Answered" below, with what the model does with each.

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
[ideal-architecture](../ideal-architecture/DECISIONS.md), where it is recorded as "core, reversed". Reverse: a new
decision by him.

### 2026-11-19 — a confirm when the screen is behind the draft

Asked on today's contract, by dialog; the atoms branch builds it. Question: what does Confirm do when the draft has
moved on from what the screen shows? Answer: "Refuse, show, confirm again". The confirm names the draft revision the
screen shows and carries only the person's own unsent rows; if the draft has moved on nothing is written, the screen
shows what changed with its new totals, and the person confirms again. His rule: nothing is confirmed that was not on
screen, and nobody's decision is overwritten at Confirm. Rejected: "Their decision stands"; "As today: your screen
wins".

In the model ([brief](BRIEF.md), "His two answers on today's contract"): `ConfirmImport` names `reviewedAt` and
carries the person's unsent acts; the aggregate records the acts and the confirm in one commit when its version is
`reviewedAt`, and otherwise records nothing and answers `ReviewMovedOn { current }`. Reverse: a new decision by him;
in the model it is the one comparison in `ConfirmImport`'s `decide`.

### 2026-11-19 — a save that changes nothing

Asked on today's contract, by dialog; the atoms branch builds it. Question: does a save's answer say that it changed
nothing? Answer: "Answer says 'no change'". The save's answer says whether it changed anything, and the screen asks
for the picture when it did not. Rejected: "Leave it until the domain model"; "Always re-read after a save".

In the model: a command that changes nothing records no event and the version stays; its reply names the rows it
changed and the rows it left, with the reason; the screen does not ask for the picture, because it follows the view.
Reverse: a new decision by him; in the model, the command's reply.

