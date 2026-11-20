---
type: Decisions
title: Decisions
description: Alchemy domain decisions. The open questions the research raised, in the order they block the brief, and the answered ones with how to reverse them.
---

# Decisions

Open questions are listed first, with the numbers [the brief](BRIEF.md) gives them, in the order they must be asked.
Each is put to Benjamin with its options, the recommended one first; nothing below is decided until he answers, and
no recommendation here is his. Answered decisions move under "Answered" with the date, the answer and how to reverse
it.

## Open

Decisions 1 to 22 shape the first moves. Decisions 23 to 35 can wait for the move that needs them.

| # | Question | Recommended in the brief | Where it is argued |
| --- | --- | --- | --- |
| 1 | How does the app take what exists only on the library's `main`? | Pin the preview build of one `main` commit, for every Alchemy package together | [02](research/02-merged-since-beta-87.md), [07](research/07-review-decisions-trial.md) trial 1 and "How it was run" |
| 2 | Where do review decisions live? | The import's lifecycle as one instance, one instance per decided row, every act a decision across both | [07](research/07-review-decisions-trial.md) trials 3 to 5 |
| 3 | How is an act on a group of rows carried? | One act per row, under one step, sent by a saga | [07](research/07-review-decisions-trial.md) "What each shape proves, costs and shows" |
| 4 | What does a person see when someone else decided the row they are deciding? | Theirs is refused for that row with the other's name; they decide again | [07](research/07-review-decisions-trial.md) trial 3 and the stories |
| 5 | What does an undo do to a row someone else changed since? | It takes back the rows that still hold the step, and says which it left | [07](research/07-review-decisions-trial.md) trial 5 |
| 6 | How deep does an undo reach on one row? | Every step, with one level proved | the brief |
| 7 | Where does the model run, and what does `bun run dev` start? | A second Effect-native Worker; `bun run dev` starts `alchemy dev` and the screens' server | [host on Cloudflare](research/concepts/host-cloudflare.md), [07](research/07-review-decisions-trial.md) trial 1 |
| 8 | Do the screens call the model's Api, or stay on `/api/v1`? | They call the model's Api | [api](research/concepts/api.md), [http api](research/concepts/http-api.md) |
| 9 | What do Confirm and a take-back become, and what does the person see if one stops halfway? | The event names a plan staged in D1 | [projection](research/concepts/projection.md), [host on Cloudflare](research/concepts/host-cloudflare.md) |
| 10 | Is an item an aggregate whose rules Verify holds? | Yes: every item its own instance | [04](research/04-trial.md), [host on Cloudflare](research/concepts/host-cloudflare.md) |
| 11 | Where does the model-call allowance live? | An aggregate that counts by day | [04](research/04-trial.md), [cluster](research/concepts/cluster.md), [Drizzle on Durable Objects](research/concepts/drizzle-durable-objects.md) |
| 12 | Which record of who is a member, with which role, is the record? | The `Organization` aggregate, with a projection writing the `member` rows | [07](research/07-review-decisions-trial.md) trial 6, [better auth](research/concepts/better-auth.md) |
| 13 | Which model runs on which host? | `Catalog` and `Access` on Durable Objects; `Usage` on Effect Cluster's pool | [host on Effect Cluster](research/concepts/host-effect-cluster.md), [cluster](research/concepts/cluster.md) |
| 14 | What scheduled work runs as a Cluster cron or singleton? | A cron that starts each organization's day of model calls | [singletons and crons](research/concepts/cluster-singletons.md) |
| 15 | Where do an aggregate's blocks live? | In the context's `model` package; ids and value schemas stay in `contract` | [project layout](research/concepts/project-layout.md), [07](research/07-review-decisions-trial.md) trial 3 |
| 16 | Are domain blocks built with `new`? | `new` in files that hold a `decide`, with that one diagnostic off | [prove](research/concepts/prove.md) |
| 17 | Where does Verify run, and what fails the build? | Proofs in `bun run check`, each model's search in `check:full`; every standing asserted | [verify](research/concepts/verify.md) |
| 18 | How does a stored state or event change shape? | By rule: optional keys, new events, a union of old and new | [event](research/concepts/event.md) |
| 19 | Who writes each audit line, and what answers the Activity page? | The `activity` table stays the trail | [stream](research/concepts/stream.md) |
| 20 | How do rows already stored arrive in the model? | Adopt at first touch | [backfill](research/concepts/backfill.md) |
| 21 | What does Remove mean once decisions are events? | Marked removed, its D1 rows deleted, the events stay | [host on Cloudflare](research/concepts/host-cloudflare.md) |
| 22 | In what order do the moves happen? | The review's model in memory, the host with the smallest slice, then the import's write side as one move | the brief, "Order of moves" |
| 23 | What answers the Items page? | A query that answers today's page | [query](research/concepts/query.md) |
| 24 | Do suggestions start by the person's press, or by themselves? | By the press, as today | [policy](research/concepts/policy.md), [saga](research/concepts/saga.md) |
| 25 | How many calls may one pass take from the 40 a day? | One, as today | [saga](research/concepts/saga.md) |
| 26 | What do confidence scores decide? | The guard's word stands; the probability is shown beside it | [confidence scores](research/concepts/confidence-scores.md) |
| 27 | Which route do scores take? | The `@effect/ai-typesafe` package with the key he reserved | [confidence scores](research/concepts/confidence-scores.md) |
| 28 | Does a scoring call count against the 40 a day? | Yes | [confidence scores](research/concepts/confidence-scores.md) |
| 29 | Which mails does the app send? | Reset, a notice to a person added, and the two import notices to the person who did it | [Resend](research/concepts/resend.md) |
| 30 | Is confirming the address turned on? | Off, as today | [Resend](research/concepts/resend.md) |
| 31 | Can a person with no account be invited? | No | [Resend](research/concepts/resend.md) |
| 32 | What may the table assistant's tools and an MCP server read, and who may call them? | Reads only, of what the person's role may read; the MCP server for admins | [agent tools and MCP](research/concepts/ai-and-mcp.md) |
| 33 | What does a notice to the team's channel contain? | Counts and the person's name; no file name | [distilled clients](research/concepts/distilled-clients.md) |
| 34 | What is GraphQL used for? | A driver that reads Cloudflare's analytics, an admin-only panel, and the operator's command line through it | [graphql](research/concepts/graphql.md) |
| 35 | What does Alchemy Git hold? | A mirror, and a history of each organization's confirmed imports | [Alchemy Git](research/concepts/alchemy-git.md) |

The brief's first version had sixteen questions. A review of it found that several joined two decisions, that some
choices were settled in a table without being asked, and that one earlier question (Alchemy Git) had been lost. They
became these: 1 is now 2; 2 is 4; 3 is 5; 4 is 1; 5 is 9 and 10; 6 is 15; 7 is 16; 8 is answered by a trial (a named
handler is read by the prover) and is no longer asked; 9 is 7; 10 is 23; 11 is 20; 12 is 22; 13 is 13, with 11, 12 and
14 split out of it; 14 is 34; 15 is 26 to 28; 16 is 29 to 31. New: 3, 6, 8, 17 to 19, 21, 24, 25, 32, 33 and 35.

Not in this list: the four small choices of Discord sign-in, asked when that move starts
([Discord sign-in](research/concepts/discord-sign-in.md)).

## Answered

### 2026-11-19 — the packet

Question: where does the material on `@alchemy.run/domain` live, and what is it for? Answer: its own exploration
packet in the repository, beside `ideal-architecture`, for agents to reference and possibly to become agent skills
later; the app is where he explores the library in full before porting beep-effect to it. His words are in
[CAPTURE.md](CAPTURE.md). Rejected: one long research report inside `ideal-architecture`. Reverse: move the pages; the
concept pages are written to be lifted into a skill's `references/` folder unchanged.

### 2026-11-19 — use, not borrow

Question: does the app use the library, or take its ideas? Answer: "Not borrow use.", and "if possible find a way to
make use of ever single thing". (The packet's working rule from that, not his words: the default for every concept
is to use it, and "cannot yet" needs the exact blocker and what removes it.) This reverses the 2026-11-18 decision "core" in
[ideal-architecture](../ideal-architecture/DECISIONS.md), where it is recorded as "core, reversed". Reverse: a new
decision by him.

### 2026-11-19 — a confirm when the screen is behind the draft

Asked on today's contract, by dialog; the atoms branch builds it. Question: what does Confirm do when the draft has
moved on from what the screen shows? Answer: "Refuse, show, confirm again". The confirm names the draft revision the
screen shows and carries only the person's own unsent rows; if the draft has moved on nothing is written, the screen
shows what changed with its new totals, and the person confirms again. His rule: nothing is confirmed that was not on
screen, and nobody's decision is overwritten at Confirm. Rejected: "Their decision stands"; "As today: your screen
wins".

In the model ([brief](BRIEF.md), "His answers on today's contract"): the confirm names the last change to the import
its sender saw, by its step, and the import refuses any other with `ReviewMovedOn { last }`; it is a proved rule
(`AConfirmIsOfWhatItsSenderSaw`). A confirm carries no acts: the screen sends the acts it holds first. Reverse: a new
decision by him; in the model it is the one comparison in `ConfirmImport`'s `decide`.

### 2026-11-19 — a save that changes nothing

Asked on today's contract, by dialog; the atoms branch builds it. Question: does a save's answer say that it changed
nothing? Answer: "Answer says 'no change'". The save's answer says whether it changed anything, and the screen asks
for the picture when it did not. Rejected: "Leave it until the domain model"; "Always re-read after a save".

In the model: an act is recorded or refused. A refusal is a rejection that says whose decision is there
(`DecidedSince { by, step }`), so the screen shows it without asking for the picture. A command's reply cannot carry
this: it is computed from the state after and the events recorded. Reverse: a new decision by him.

### 2026-11-20 — a save failed, decisions wait, and the person reloads

Asked on today's review saving, by dialog; the atoms branch builds it. Answer: "Keep them and send them". The waiting
rows are kept in the browser as waiting rows, come back after a reload marked not saved yet and are sent again; the
browser asks before the page is left while rows wait. His rule: a decision the person made is either on the server or
still waiting, never neither. The options he rejected were not passed on with the answer.

In the model: the queue of the person's acts the server has not answered is kept in the saved progress, each act with
its step and command id, so a resend answers the first receipt. Reverse: a new decision by him.

### 2026-11-20 — decisions wait and someone else confirms the import

Asked on today's review saving, by dialog; the atoms branch builds it. Answer: "Name the rows, then drop them".
Nothing is sent to the closed import; the result screen says which rows the person had decided that were not part of
the confirm, with what they had decided. The options he rejected were not passed on with the answer.

In the model: the queue sends nothing once the import is confirmed, and an act already on its way is refused with
`NotOpen` (`ARowIsDecidedOnlyOnAnOpenImport`, proved). The naming is the screen's. Reverse: a new decision by him.

### 2026-11-20 — an accept waits while its field's column is matched again

Asked on today's review saving, by dialog; the atoms branch builds it. Answer: "Server refuses, screen says so". A
save names the column matching it was made on; an accept made on an older matching is not applied, the row shows the
new proposal as open, and the screen says which accepts were taken back. The options he rejected were not passed on
with the answer.

In the model: an accept names its field and the matching of that field its sender saw, and is refused on an older one
with `MatchedSince` (`AnAcceptIsMadeOnTheMatchingItsSenderSaw`, proved). It sits beside the check on the decision an
act saw and is not the same check: that one is about one row's decision, and a match changes what is proposed for
rows nobody has decided. A match changes no row; an accept made before it is out of force by its number. Not asked:
whether keeping one of two rows with the same SKU also names the matching of the SKU's column. Reverse: a new
decision by him.
