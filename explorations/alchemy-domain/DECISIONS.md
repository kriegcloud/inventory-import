---
type: Decisions
title: Decisions
description: Alchemy domain decisions. The open questions, one decision each, in the order the brief asks them, and the answered ones with the options he rejected and how to reverse them.
---

# Decisions

Open questions are listed first, with the numbers [the brief](BRIEF.md) gives them, in the order they must be asked.
Each is put to Benjamin with its options, the recommended one first; nothing below is decided until he answers, and
no recommendation here is his. Answered decisions move under "Answered" with the date, the answer and how to reverse
it.

## Open

Decisions 1 to 31 shape the first moves. Decisions 32 to 53 can wait for the move that needs them. "Changes" names
the earlier answers that remove or change an option.

| # | Question | Recommended in the brief | Changes | Where it is argued |
| --- | --- | --- | --- | --- |
| 1 | How does the app take what exists only on the library's `main`? | Pin one commit's preview build, its tarballs kept in the repository | | [02](research/02-merged-since-beta-87.md), [07](research/07-review-decisions-trial.md) "How it was run" |
| 2 | What does a person see when someone else decided the row they are deciding? | Theirs is refused for that row with the other's name; they decide again | | [07](research/07-review-decisions-trial.md) trial 3, third round |
| 3 | Where do review decisions live? | The import's lifecycle, one instance per decided row, every act a decision across both | 1, 2 | [07](research/07-review-decisions-trial.md) third round |
| 4 | Do a confirm and a take-back stay one write? | They become facts on the import, their writes after | 3 | [projection](research/concepts/projection.md), [host on Cloudflare](research/concepts/host-cloudflare.md) |
| 5 | How is an act on a group of rows carried? | One act per row under the group's step, the import marked while it is sent | 3 | [07](research/07-review-decisions-trial.md) third round, [saga](research/concepts/saga.md) |
| 6 | How deep does an undo reach on one row? | Every step: the first level exactly, each deeper level checked by its step | 3 | [07](research/07-review-decisions-trial.md) third round |
| 7 | Is a kept one of two rows with the same SKU still kept after the SKU column is matched again? | No: a keep is an accept of the SKU field and goes with a new match | | the brief |
| 8 | Is an item an aggregate whose rules Verify holds? | Yes, each item its own instance, its record held as text | 4 | [07](research/07-review-decisions-trial.md) third round, [host on Cloudflare](research/concepts/host-cloudflare.md) |
| 9 | What does a confirm write, and from what? | A plan staged in D1, built at the import's last change | 8 | [host on Cloudflare](research/concepts/host-cloudflare.md) |
| 10 | What happens when a confirm's write keeps failing? | It stays confirmed and is retried; the screen says nothing is lost | | [projection](research/concepts/projection.md) |
| 11 | Which record of who is a member is the record? | `Organization` and one `Member` instance each, changed by decisions that read the sender's own record | | [07](research/07-review-decisions-trial.md) third round, [better auth](research/concepts/better-auth.md) |
| 12 | Are Better Auth's own writes to `member` closed? | Closed | 11 | [better auth](research/concepts/better-auth.md) |
| 13 | What does a removed person's open page receive? | Nothing more: every push is checked against the member record | | [view security](research/concepts/view-security.md) |
| 14 | Is a Discord sign-in with an unverified email accepted? | Refused | | [Discord sign-in](research/concepts/discord-sign-in.md) |
| 15 | Can a person with no account be invited? | No, as his infra I8 | | [Resend](research/concepts/resend.md) |
| 16 | When do the 40 model calls come back? | At 00:00 UTC each day | | [07](research/07-review-decisions-trial.md) third round |
| 17 | Where does the model-call allowance live? | An aggregate per organization | 16 | [cluster](research/concepts/cluster.md), [Drizzle on Durable Objects](research/concepts/drizzle-durable-objects.md) |
| 18 | Which model runs on which host? | `Catalog` and `Access` on Durable Objects; `Usage` on the Cluster pool | 11, 17 | [host on Effect Cluster](research/concepts/host-effect-cluster.md) |
| 19 | What runs on the Cluster pool as a cron or a singleton? | A cron that closes each day into a history, and a singleton with the operator's live total | 18 | [singletons and crons](research/concepts/cluster-singletons.md) |
| 20 | What is deployed: one Worker or two? | Two: the site, and an Effect-native Worker for the model | | [host on Cloudflare](research/concepts/host-cloudflare.md) |
| 21 | What does `bun run dev` start? | `alchemy dev` for both Workers and the screens' server | | [07](research/07-review-decisions-trial.md) trial 1, third round |
| 22 | Do the screens call the model's Api, or stay on `/api/v1`? | The model's Api | 20 | [api](research/concepts/api.md), [http api](research/concepts/http-api.md) |
| 23 | Where do an aggregate's blocks live? | In the context's `model` package, each model with its own `CurrentActor` | | [project layout](research/concepts/project-layout.md) |
| 24 | Are domain blocks built with `new`? | `new` in files that hold a `decide`, with that one diagnostic off | | [prove](research/concepts/prove.md) |
| 25 | Where does Verify run, and what fails the build? | Proofs in `bun run check`, each model's search in `check:full` | | [verify](research/concepts/verify.md), [07](research/07-review-decisions-trial.md) third round |
| 26 | How does a stored state or event change shape? | By rule: optional keys, new events, a union of old and new | | [event](research/concepts/event.md) |
| 27 | Who writes each audit line? | The `activity` table stays the trail | | [stream](research/concepts/stream.md) |
| 28 | How do rows already stored arrive in the model? | Adopt at first touch | 8 | [backfill](research/concepts/backfill.md) |
| 29 | What does Remove do once decisions are events? | Marked removed, its D1 rows deleted, the events stay | | [host on Cloudflare](research/concepts/host-cloudflare.md) |
| 30 | What is kept for ever? | Kept, as the library keeps it; an operator's command deletes an organization's objects when it leaves | 29 | [host on Cloudflare](research/concepts/host-cloudflare.md) |
| 31 | In what order do the moves happen? | The review's model in memory, the host with the smallest slice, then the import's write side | 11, 17 | the brief, "Order of moves" |
| 32 | How long may a group act take before a group is decided as one unit? | 5 minutes | 5 | [07](research/07-review-decisions-trial.md) third round |
| 33 | What answers the Items page? | A query that answers today's page | | [query](research/concepts/query.md) |
| 34 | Do suggestions start by the person's press, or by themselves? | By the press, as today | | [policy](research/concepts/policy.md) |
| 35 | How many calls may one pass take from the 40 a day? | One, as today | | [saga](research/concepts/saga.md) |
| 36 | What do confidence scores decide? | The guard's word stands; the probability is shown beside it | | [confidence scores](research/concepts/confidence-scores.md) |
| 37 | Which route do scores take? | `@effect/ai-typesafe` with the key he reserved (reverses infra I5) | | [confidence scores](research/concepts/confidence-scores.md) |
| 38 | Does a scoring call count against the 40 a day? | Yes | | [confidence scores](research/concepts/confidence-scores.md) |
| 39 | Which mails does the app send? | Reset, a notice to a person added, and the two import notices to the person (reverses infra I6) | | [Resend](research/concepts/resend.md) |
| 40 | Is confirming the address turned on? | Off, as today | 39 | [Resend](research/concepts/resend.md) |
| 41 | What may the assistant's tools and an MCP server read? | Reads only, of what the person's role may read | | [agent tools and MCP](research/concepts/ai-and-mcp.md) |
| 42 | Who may call the MCP server? | Admins | | [agent tools and MCP](research/concepts/ai-and-mcp.md) |
| 43 | What does a notice to the team's channel contain? | Counts and the person's name; no file name | | [distilled clients](research/concepts/distilled-clients.md) |
| 44 | Which channel gets notices? | One per organization, set by its admin | | [distilled clients](research/concepts/distilled-clients.md) |
| 45 | What is GraphQL used for? | A driver that reads Cloudflare's analytics, an admin panel, the command line through it | | [graphql](research/concepts/graphql.md) |
| 46 | What does Alchemy Git hold? | A mirror, and a history of each organization's confirmed imports | | [Alchemy Git](research/concepts/alchemy-git.md) |
| 47 | Are workflows only the sagas, or also an Effect workflow on the Worker that has D1? | Also a workflow: the sweep of unused plans | | [workflows](research/concepts/cluster-workflows.md) |
| 48 | Is "Rivet cannot yet" accepted? | Accepted | | [host on Rivet](research/concepts/host-rivet.md) |
| 49 | Is "CI on Alchemy Git cannot yet" accepted? | Accepted | | [Alchemy Git](research/concepts/alchemy-git.md) |
| 50 | Is "workflow files through the GitHub provider cannot yet" accepted? | Accepted | | [GitHub](research/concepts/github.md) |
| 51 | May a person link Discord to their account? | From a signed-in session only | 14 | [Discord sign-in](research/concepts/discord-sign-in.md) |
| 52 | Which stages offer Discord? | Production and previews | 14 | [Discord sign-in](research/concepts/discord-sign-in.md) |
| 53 | What does a person read when a Discord sign-in fails? | The app's own sentence | 14 | [Discord sign-in](research/concepts/discord-sign-in.md) |

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
is to use it, and "cannot yet" needs the exact blocker and what removes it.) This reverses the 2026-11-18 decision
"core" in [ideal-architecture](../ideal-architecture/DECISIONS.md), where it is recorded as "core, reversed". Reverse:
a new decision by him.

### 2026-11-19 — a save that changes nothing

Asked on today's contract, by dialog; built on the atoms branch (`7b09ee4`). Question: how does the screen tell that a
save changed nothing? Answer: "Answer says 'no change'". It was the recommended option. The save's answer
says whether it changed anything, and the screen asks for the picture when it did not. Rejected: "Leave it until the
domain model"; "Always re-read after a save".

In the model: an act that would leave its row as it is records nothing, and its receipt has no events, which the
screen reads as "no change" (`AnActThatChangesNothingRecordsNothing`, proved). Reverse: a new decision by him.

### 2026-11-19 — a confirm made on a draft somebody else has changed

Asked on today's contract, by dialog; built on the atoms branch (`42c8303`). Question: what does Confirm do when the
other person has decided a row this screen has not shown yet? Answer: "Refuse, show, confirm again". It was the recommended option. If the draft has moved on nothing is written, the screen shows what changed with its new
totals, and the person confirms again. His rule: nothing is confirmed that was not on screen, and nobody's decision is
overwritten at Confirm. Rejected: "Their decision stands"; "As today: your screen wins".

In the model: the confirm names the last change its screen received and the change its plan was built at; the import
takes it only when every change after the first came from that screen, the second is the last change, and no group
act is being sent (`AConfirmIsOfWhatItsScreenHadReceived`, `APlanIsOfTheLastChange`, `NoConfirmWhileAGroupIsSent`,
proved). That the screen sends Confirm only after its own acts came back, and that the handler builds the plan from
rows written up to that change, are tested. Reverse: a new decision by him.

### 2026-11-20 — rows that wait unsaved when the page is reloaded

Asked on today's review saving, by dialog; built on the atoms branch (`fa83274`). Question: a save failed, rows wait
unsaved, and the person reloads: what becomes of them? Answer: "Keep them and send them". It was the recommended option. The waiting rows come back after a reload marked not saved yet and are sent again; the browser
asks before the page is left while rows wait. His rule: a decision the person made is either on the server or still
waiting, never neither. Rejected: "Warn before leaving only"; "Drop them and say which".

In the model: the queue of the person's acts the server has not answered is kept in the saved progress, each act with
its step and command id, so a resend answers the first receipt. Reverse: a new decision by him.

### 2026-11-20 — rows that wait unsaved when somebody else confirms the import

Asked on today's review saving, by dialog; built on the atoms branch (`fa83274`). Question: rows wait unsaved and
someone else confirms the import: what becomes of them? Answer: "Name the rows, then drop them". It was the recommended option. Nothing is sent to the closed import; the result says which rows the person had decided that
were not part of the confirm, with what they had decided. Rejected: "Drop them without a word".

In the model: the queue sends nothing once the import is confirmed, and an act already on its way is refused with
`NotOpen` (`ARowIsDecidedOnlyOnAnOpenImport`, proved). The naming is the screen's. Reverse: a new decision by him.

### 2026-11-20 — an accept that waits while its field's column is matched again

Asked on today's review saving, by dialog; built on the atoms branch (`fa83274`). Question: what happens to that
accept? Answer: "Server refuses, screen says so". It was the recommended option. An accept made on an older
matching is not applied, the row shows the new proposal as open, and the screen says which accepts were taken back.
Rejected: "Screen drops it only"; "As today".

In the model: an act names the import's matching its accepts were made on, and is refused with `MatchedSince` if any
column was matched since (`AnActsAcceptsAreMadeOnTheMatchingNow`, proved); the screen sends it again without the
accepts whose field was matched since. The import keeps each field's last match, as today's column choice keeps the
revision that first has it, and every reader asks `acceptInForce` whether a stored accept still holds (tested).
Whether a kept one of two rows with the same SKU goes the same way is decision 7. Reverse: a new decision by him.
