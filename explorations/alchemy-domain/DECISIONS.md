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

Decisions 1 to 40 shape the first moves. Decisions 41 to 62 can wait for the move that needs them. "Changes" names
the earlier answers that remove or change an option. Decisions 1 to 6, 10 to 23, 25 to 40 and 57 to 59 were answered
on 2026-11-22 and are under "Answered". Of 1 to 40 only 7, 8 and 9 are open, waiting with 41 on a trial he asked for;
24 stands on his earlier infra answer, I8, and was not asked again. Decisions 41 to 56 and 60 to 62 are asked each when
its move opens, as he chose on 2026-11-22. The numbers of the others stay as the brief gives them.

| # | Question | Recommended in the brief | Changes | Where it is argued |
| --- | --- | --- | --- | --- |
| 7 | How is an act on a group of rows carried? | One act per row under the group's step, the import counting its rows. **Asked 2026-11-22, not decided:** he chose to have the one-unit design trialled first; 8, 9 and 41 wait on it | 4 | [07](research/07-review-decisions-trial.md) third round, [saga](research/concepts/saga.md) |
| 8 | While one person's group is being sent, what can the others do? | Decide and undo single rows; matches, groups, confirm, take-back and remove wait | 7 | [07](research/07-review-decisions-trial.md) fourth round |
| 9 | Who may stop a group act whose sender no longer can? | Its sender or an admin; the rows not sent are counted on the import | 7 | [07](research/07-review-decisions-trial.md) fourth round |
| 24 | Can a person with no account be invited? | No, as his infra I8 | | [Resend](research/concepts/resend.md) |
| 41 | How long may a group act take before a group is decided as one unit? | 5 minutes | 7 | [07](research/07-review-decisions-trial.md) third and fourth rounds |
| 42 | What answers the Items page? | A query that answers today's page | | [query](research/concepts/query.md) |
| 43 | Do suggestions start by the person's press, or by themselves? | By the press, as today | | [policy](research/concepts/policy.md) |
| 44 | How many calls may one pass take from the 40 a day? | One, as today | | [saga](research/concepts/saga.md) |
| 45 | What do confidence scores decide? | The guard's word stands; the probability is shown beside it | | [confidence scores](research/concepts/confidence-scores.md) |
| 46 | Which route do scores take? | `@effect/ai-typesafe` with the key he reserved (reverses infra I5) | | [confidence scores](research/concepts/confidence-scores.md) |
| 47 | Does a scoring call count against the 40 a day? | Yes | | [confidence scores](research/concepts/confidence-scores.md) |
| 48 | Which mails does the app send? | Reset, a notice to a person added, and the two import notices to the person (reverses infra I6) | | [Resend](research/concepts/resend.md) |
| 49 | Is confirming the address turned on? | Off, as today | 48 | [Resend](research/concepts/resend.md) |
| 50 | What may the assistant's tools and an MCP server read? | Reads only, of what the person's role may read | | [agent tools and MCP](research/concepts/ai-and-mcp.md) |
| 51 | Who may call the MCP server? | Admins | | [agent tools and MCP](research/concepts/ai-and-mcp.md) |
| 52 | What does a notice to the team's channel contain? | Counts and the person's name; no file name | | [distilled clients](research/concepts/distilled-clients.md) |
| 53 | Which channel gets notices? | One per organization, set by its admin | | [distilled clients](research/concepts/distilled-clients.md) |
| 54 | What is GraphQL used for? | A driver that reads Cloudflare's analytics, an admin panel, the command line through it | | [graphql](research/concepts/graphql.md) |
| 55 | What does Alchemy Git hold? | A mirror, and a history of each organization's confirmed imports | | [Alchemy Git](research/concepts/alchemy-git.md) |
| 56 | Are workflows only the sagas, or also an Effect workflow on the Worker that has D1? | Also a workflow: the sweep of unused plans | | [workflows](research/concepts/cluster-workflows.md) |
| 60 | May a person link Discord to their account? | From a signed-in session only | 23 | [Discord sign-in](research/concepts/discord-sign-in.md) |
| 61 | Which stages offer Discord? | Production and previews | 23 | [Discord sign-in](research/concepts/discord-sign-in.md) |
| 62 | What does a person read when a Discord sign-in fails? | The app's own sentence | 23 | [Discord sign-in](research/concepts/discord-sign-in.md) |

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

In the model (trial 13): an act that would leave its row as it is records nothing, and its receipt has no events, which
the screen reads as "no change" (`AnActThatChangesNothingLeavesTheImport`, `…LeavesTheRow`, proved). The question he
answered named "rows somebody else had just decided the same way"; what that leaves the second person with is decision 3.
Reverse: a new decision by him.

### 2026-11-19 — a confirm made on a draft somebody else has changed

Asked on today's contract, by dialog; built on the atoms branch (`42c8303`). Question: what does Confirm do when the
other person has decided a row this screen has not shown yet? Answer: "Refuse, show, confirm again". It was the
recommended option. If the draft has moved on nothing is written, the screen shows what changed with its new totals, and
the person confirms again. His rule: nothing is confirmed that was not on screen, and nobody's decision is overwritten
at Confirm. Rejected: "Their decision stands"; "As today: your screen wins".

In the model (trial 13): the import numbers every change. The confirm names the last change its screen has received with
none before it missing, the change its plan was built at, and what its button said; the import takes it only when both
numbers are its last, the plan does what was shown, and no group act is being sent (`AConfirmNamesEveryChange`,
`APlanIsOfEveryChange`, `APlanDoesWhatWasShown`, `NothingEndsAReviewWhileAGroupIsSent`, proved). The rule for the
number a screen may name ran as a property, on a copy of the rule written in the test and not on the screen's code. That
the screen sends Confirm only after its own acts came back, and that the handler builds the plan from rows written up to
that change, are tests to write: not run. Reverse: a new decision by him.

### 2026-11-20 — rows that wait unsaved when the page is reloaded

Asked on today's review saving, by dialog; built on the atoms branch (`fa83274`). Question: a save failed, rows wait
unsaved, and the person reloads: what becomes of them? Answer: "Keep them and send them". It was the recommended option.
The waiting rows come back after a reload marked not saved yet and are sent again; the browser asks before the page is
left while rows wait. His rule: a decision the person made is either on the server or still waiting, never neither.
Rejected: "Warn before leaving only"; "Drop them and say which".

In the model: the queue of the person's acts the server has not answered is kept in the saved progress, each act with
its step and command id, so a resend answers the first receipt. Reverse: a new decision by him.

### 2026-11-20 — rows that wait unsaved when somebody else confirms the import

Asked on today's review saving, by dialog; built on the atoms branch (`fa83274`). Question: rows wait unsaved and
someone else confirms the import: what becomes of them? Answer: "Name the rows, then drop them". It was the recommended
option. Nothing is sent to the closed import; the result says which rows the person had decided that were not part of
the confirm, with what they had decided. Rejected: "Drop them without a word".

In the model: the queue sends nothing once the import is confirmed, and an act already on its way is refused with
`NotOpen` (`ARowIsDecidedOnlyOnAnOpenImport`, proved). The naming is the screen's. Reverse: a new decision by him.

### 2026-11-20 — an accept that waits while its field's column is matched again

Asked on today's review saving, by dialog; built on the atoms branch (`fa83274`). Question: what happens to that
accept? Answer: "Server refuses, screen says so". It was the recommended option. An accept made on an older
matching is not applied, the row shows the new proposal as open, and the screen says which accepts were taken back.
Rejected: "Screen drops it only"; "As today".

In the model (trial 13): every act names the import's matching it was made on, and is refused with `MatchedSince` if any
column was matched since (`AnActIsMadeOnTheMatchingNow`, proved); the screen sends it again without the parts whose
field was matched since. Each part of a decision's text keeps the matching it was made on, and the import's events hold
every field's column at every match, so every reader can tell whether a stored part still holds (tested, not run).
Reverse: a new decision by him.

### 2026-11-20 and 2026-11-21 — his later answers on saving the review

Asked by dialog on today's contract and built on the atoms branch after `d7594bd`, where each is recorded in full
(`explorations/ideal-architecture/DECISIONS.md` on that branch, the entries that begin "atoms,"). Each was the recommended
option. What each asks of the model is in the brief, "His answers, carried into the model". Reverse each: a new decision by
him.

| Question | Answer | Rejected |
| --- | --- | --- |
| A Replace or a Keep-stored, and the SKU column is matched again | Server refuses, says so | Keep it as made |
| A keep of one of two rows, and the SKU column is matched again | Server refuses, says so | Keep it as made |
| A Replace or a Keep-stored, and another column is matched again | Refuse if it changes the row | Refuse every one; Keep it as made |
| A fix the person undid, and its field's column is matched again | Server refuses, says so | Keep it as made |
| A field matched by hand to the column it already reads: what is taken back? | Only when it changes. A field displaced by another's match counts as moved | Any pick by hand |
| A Replace or Keep-stored on an import matched before moves were kept | Take it back, say so | Keep it as made |
| A row that waited was decided otherwise since | Hold it, show both, ask | Send it, last press wins; Drop hers, name it |
| What a refused save does to waiting rows | Keep them, say why, until decided again or dismissed; signed out counts as waiting | Name them once, drop; As built |
| Two tabs of one person | Each tab keeps its own; a tab takes up only a gone tab's rows | One list, merged by row |
| A refused row beside a closed tab's decision of the same row | Keep both, she picks | Name once, then drop |
| A tab the browser discarded: is it gone? | Yes, and it says so | Only after a while |
| Import while a row is held | Wait until she picks; one press settles many | Import, theirs stands |
| Import while a row is refused | Wait, like a held row | Import and name it |
| Who is shown what a match took back? | Yes, everyone, until each dismisses it | Only who was there |

"Hold it, show both, ask" is about a row that waited. Whether it holds for a row that did not is decision 2.

### 2026-11-22 — decisions 1, 2, 3 and 6 of the brief

Asked by dialog from the brief as it stood, rewritten and not yet committed or reviewed, which he knew. Each question and
its options are the brief's. Of each: I chose; the agent recommended the same. Reverse each: a new decision by him.

| # | Question | Options, the recommended one first | Answer |
| --- | --- | --- | --- |
| 1 | How does the app take what exists only on the library's `main`? | Pin one commit's preview build, with its tarballs kept in the repository; vendor the built source of one commit; follow the head of `main`, re-pinned at least weekly; wait for the release that has them | "Pin a commit, keep tarballs" |
| 2 | Two people decide the same row in the same moment. What does the second one see? | The same as for a row that waited: theirs is held, the row shows both with whose is whose, they pick one, and Confirm waits until they do; acts merge by field; the later act wins | "Same: hold, show both" |
| 3 | A person saves, for a row, the decision someone else already made there. Is it theirs too? | No: it changes nothing, and the answer says so, naming whose it is; yes: it is recorded over the other's as their own | "No, it stays Dana's" |
| 6 | The stored items changed since the screen was drawn, so Confirm would do something else than its button says. What happens? | It is refused, the screen shows the new counts, and the person confirms again; as today: it is confirmed, and the result says what it did | "Refuse, show, confirm again" |

What each leaves unproved is in the brief under its number: for 2, that the queue holds the act and Confirm waits; for 3,
that the screen says whose the row is; for 6, what the two digests cover.

### 2026-11-22 — decisions 4, 13, 15 and 16 of the brief

A second round of the same dialog, from the same uncommitted brief. Of each: I chose; the agent recommended the same.
Reverse each: a new decision by him.

| # | Question | Options, the recommended one first | Answer |
| --- | --- | --- | --- |
| 4 | Where do review decisions live? | The import's lifecycle as one instance, one instance per decided row, and every act a decision across both; the same instances, with a row taking its own commands and no decision across; one instance per import | "Import + rows, acts across both" |
| 13 | An act made before a confirm arrives after the import was opened again. Is it taken? | No: it is refused and the screen names the row, as for a closed import; yes: it is recorded on the row | "No, name it and drop it" |
| 15 | Is a column match refused when its sender has not seen the last one? | Yes: refused, the screen shows the column as it is now, and they choose again; as today: the last match wins | "Yes, refuse and show" |
| 16 | Is Remove refused when its sender has not seen the import's last change? | Yes, and while a group is being sent; as today | "Yes, refuse and show" |

What he was told with decision 4: 93 rules are proved, of the trial's model and not of the app; an act is about 4 requests
between objects and 131 to 151 ms on the mean in local workerd; acts go through the import one after another, so a group
of 6,000 rows is 13 to 15 minutes, worked out from that and not measured; one object for each decided row is kept for
ever.

### 2026-11-22 — decisions 5, 10 and 12 of the brief, and 7 left open

A third round of the same dialog. Of each of the three: I chose; the agent recommended the same. Reverse each: a new
decision by him.

| # | Question | Options, the recommended one first | Answer |
| --- | --- | --- | --- |
| 5 | Do a confirm and a take-back stay one write? | The confirm and the take-back become facts on the import, and their writes land after; each stays one D1 write, and the import does not record the confirm | "Yes, fact first, writes after" |
| 10 | How deep does an undo reach on one row? | Every step, exactly, with everything below the first level sealed into one text; every step, with the undo sent by the server alone; every step, held in the row's state as a list; one level | "Every step, sealed history" |
| 12 | Can an undo reach past a confirm that stands? | No, for both: it is refused as decided before the last confirm; no for a row the confirm imported, yes for one it did not; yes: the decision is taken back and the item keeps the value | "No, refused for both" |

With decision 5 he was told that it reverses the app's written rule that a confirm and a take-back are each one atomic
write, and that `docs/standards/undo.md` and `CLAUDE.md` are rewritten in the move that makes it so.

Decision 7, how an act on a group of rows is carried, was asked in the same round and is not answered. He saw three
options: "Trial the one-unit design first", "One act per row" (the brief's recommendation) and "One unit, untested", and
chose the first, against the brief's recommendation. The reason he was given: one act per row is proved and takes 13 to
15 minutes for 6,000 rows, worked out, with Confirm waiting; the one-unit design has never been run, so its standing
under Verify is unknown. Decision 7 stays open until that trial reports, and decisions 8, 9 and 41 with it.

### 2026-11-22 — decisions 11, 14, 17 and 19 of the brief

A fourth round of the same dialog. Of each: I chose; the agent recommended the same. Reverse each: a new decision by him.

| # | Question | Options, the recommended one first | Answer |
| --- | --- | --- | --- |
| 11 | A decision its maker took back lies under another's. When that one is undone, does it come back? | Yes: an undo puts back exactly what was under it, whose it was; no: what its maker took back while it lay under is passed over | "Yes, exactly what was under" |
| 14 | What is a keep of one of two rows, when someone decides the other row meanwhile? | The keep is one act on the kept row, and `review` leaves its rivals out by rule; one decision across the rows that share the SKU; as today, row by row | "One act on the kept row" |
| 17 | Is an item an aggregate whose rules Verify holds? | Yes: every item is its own instance, its record held as text; no: items stay rows that one batch writes per confirm | "Yes, each item an object" |
| 19 | What happens when a confirm's write keeps failing? | The import stays confirmed and the write keeps being retried; after it has failed for a set time, the server opens the import again | "Stay confirmed, keep retrying" |

With decision 17 he was told: ten rules are proved, of the trial's model; items arrive over minutes, and the Items page
can show part of an import; 38,750 items take 194,000 to 271,000 requests, worked out and not measured; one object per
item is kept for ever. Decision 14 was put to him as not run: it needs its trial before anything about it is called
proved. Decision 24 was not asked: his infra answer I8 stands.

### 2026-11-22 — decisions 18, 20 to 23, 25 to 27, 29 to 31 and 34 of the brief

Further rounds of the same dialog. Of each: I chose; the agent recommended the same. Reverse each: a new decision by him.

| # | Question | Options, the recommended one first | Answer |
| --- | --- | --- | --- |
| 18 | What does a confirm write, and from what? | A plan staged in D1, built at the import's last change; the events carry the rows, in parts of 1,000, sent by a saga | "A plan staged in the database" |
| 20 | Which record of who is a member, with which role, is the record? | An `Organization` aggregate and one `Member` instance per member are the record; Better Auth's table stays the record; the record as in the first option, and the session reads the role from a view of it | "Organization + Member objects" |
| 21 | Are Better Auth's own writes to `member` closed? | Closed; sent through commands by a hook on Better Auth's writes | "Close them" |
| 22 | What does a removed person's open page receive? | Nothing more: every pushed change is checked against the member record; what is pushed until the socket drops | "Nothing more" |
| 23 | Is a Discord sign-in with an unverified email accepted? | Refused: the account is not created; accepted as the account's address | "No, refuse it" |
| 25 | When do the 40 model calls come back? | At 00:00 UTC each day; 24 hours after each was used, as today | "At midnight UTC" |
| 26 | Where does the model-call allowance live? | An aggregate per organization; an entity on Effect Cluster's pool; a Drizzle table in one object per organization | "An aggregate per organization" |
| 27 | Which model runs on which host? | `Catalog` and `Access` on Durable Objects, `Usage` on the Cluster pool; everything on Durable Objects; `Access` on the pool; Effect Cluster on Postgres runners | "Usage on Cluster, rest on DOs" |
| 29 | What is deployed: one Worker or two? | A second, Effect-native Worker beside the site's; one Effect-native Worker that hosts the model, serves the API and serves the screens | "Two Workers" |
| 30 | What does `bun run dev` start? | `alchemy dev` for both Workers and the screens' server beside it; the model in memory under `vite` | "alchemy dev + the screens" |
| 31 | Do the screens call the model's Api, or stay on `/api/v1`? | They call the model's Api; they stay on `/api/v1` | "Call the model's API" |
| 34 | Where does Verify run, and what fails the build? | The decisions' and aggregates' proofs in `bun run check`, each model's search in `check:full` and CI; all of it in `check:full` and CI only; all of it in `bun run check` | "Proofs in check, search in check:full" |

With decision 20 he was told that a session's role lags the record for a moment, until its row lands. Decision 22 was
put to him as not run. With decision 27 he was told that the Cluster pool is reached through a public gateway behind
one token, which cannot be turned off, and that a value kept there is at most 2 MiB. With decision 30 he was told the
four points not verified: two Workers and Vite side by side, the D1 migrations, objects that survive a restart, and the
session cookie on a forwarded request.

### 2026-11-22 — decisions 28, 32, 33 and 36 to 40 of the brief

Further rounds of the same dialog. Of each: I chose; the agent recommended the same. Reverse each: a new decision by him.

| # | Question | Options, the recommended one first | Answer |
| --- | --- | --- | --- |
| 28 | What runs on the Cluster pool as a cron or a singleton? | A cron that closes each organization's day of model calls into a history, and a singleton that keeps the operator's live total; the cron only; neither: "cannot yet" written down | "A history cron + a live total" |
| 32 | Where do an aggregate's blocks live? | In the context's `model` package, one folder per aggregate; everything in `contract`; leave the blocks split and wait for the prover | "In each model package" |
| 33 | Are domain blocks built with `new`? | `new` in files that hold a `decide`; `new` for every domain class; `.make` everywhere | "`new` only in decide files" |
| 36 | Who writes each audit line, and what answers the Activity page? | The `activity` table stays the trail; a stream per model | "The activity table stays" |
| 37 | How do rows already stored arrive in the model? | Adopt at first touch; adopt everything at a deploy; start empty | "Adopt at first touch" |
| 38 | What does Remove do once decisions are events? | The import is marked removed and its rows in D1 are deleted, the events stay; the app also deletes the objects' storage | "Mark removed, events stay" |
| 39 | What is kept for ever? | Kept, as the library keeps it, an operator's command deleting an organization's objects when it leaves; the app deletes a member's email when they are removed | "Keep, delete when an org leaves" |
| 40 | In what order do the moves happen? | The review's model in memory, then the host with the smallest slice, then the import's write side; people first on the host; the import's write side first on the host | "Review in memory, then host" |

Decision 28 was put to him as not run. With decision 32 he was told that his answer of 2026-11-18 on the kernel's
`CurrentActor` stands, and that the model's is a second declaration of the same name. With decision 39 he was told that
a removed person's email stays in the events until their organization leaves.

### 2026-11-22 — decision 35 of the brief, 57 to 59, and the rest at their move

The last round of the same dialog. Of each: I chose; the agent recommended the same. Reverse each: a new decision by him.

| # | Question | Options, the recommended one first | Answer |
| --- | --- | --- | --- |
| 35 | How does a stored state or event change shape? | By rule; always wipe | "By rule" |
| 57, 58, 59 | Which do you want built anyway? | None: each "cannot yet" accepted; Rivet, a runner for CI on Alchemy Git, or a resource for workflow files through the GitHub provider | "None: accept all three" |

Decisions 57, 58 and 59 were asked as one question. Each is accepted as "cannot yet", with what would remove its blocker
as the brief states it: for 57 a Rivet control plane the Worker can reach and a pool outside Cloudflare, for 58 a runner
the project builds, for 59 a resource over the contents API.

Decisions 41 to 56 and 60 to 62 were put to him together, and his answer was "At their move": he does not want them
now, and each is asked when its move opens. They stay under "Open".
