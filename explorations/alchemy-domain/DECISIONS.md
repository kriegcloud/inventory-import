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

Decisions 1 to 40 shape the first moves. Decisions 41 to 62 can wait for the move that needs them. "Changes" names the
earlier answers that remove or change an option. Decisions 1 to 8, 10 to 23, 25 to 40 and 57 to 59 were answered on
2026-11-22 and are under "Answered"; 9 and 41 fell away with his answer to 7 and were not asked. Of 1 to 40 only one
point his answers left is open: 21a, under decision 21, asked when move 6 opens (and five unnumbered points, below: a
warning before a group's undo, under decision 8, accepted fixes after a keep, under decision 14, the check of who may
change a row or a group beside the lock, how rows are adopted at first touch, under decision 37, and whether a staging
deploy is one he keeps); 14a, 14b and 34a were answered later the same day and are under "Answered". 24 stands on his
earlier infra answer, I8 ("Close sign-up; I add accounts", 2026-11-19), and was not asked again: it is not open.
Decisions 42 to 56 and 60 to 62 are asked each when its move opens, as he chose on 2026-11-22. The numbers of the others
stay as the brief gives them.

One point the brief leaves open, under decision 8, not numbered and not yet asked: when Ana undoes a group after Dana
changed one of its rows, the screen says "Row 14 was changed by Dana and stays". A group's undo names no `seen`, so the
undo can be taken from a screen that has not received Dana's act, and the sentence can only follow the undo. Whether the
screen also warns before the undo, when it already holds a later decision on one of the group's rows, is his to decide.

A second unnumbered point, under decision 14, not yet asked: a decision someone makes on a rival after the keep wins
over the keep (14a), and a clash is shown when that would import both rows with one SKU. Whether an accept made on a
rival after the keep counts as such a decision, or leaves the rival out as one made before the keep does ("As today,
never overwrite a choice"), is his to decide.

A third unnumbered point, not yet asked: whether our check that each decision recording on a row or a group states the
three rules on who may change it (`missingRules`) stands beside his answer "no hand-written assertions". It was removed
with the hand-written lists and restored on the build's branch, by the build's own report, without asking him.

A fourth unnumbered point, under decision 37, not yet asked: his answer "Adopt at first touch" stands; open is how
stored rows are adopted. The option was put to him as an `Adopt…` command, and the pin has a second way. By a command
of the model: its rewritten rules (`NothingIsWrittenBeforeConfirm`, and decision 25's `ANewDayStartsAtOne` and
`WithinADayTheCountRisesByOne`) are proved again with adoption, and it states the three rules on who may change a row
or a group. By the library's `import` of events already decided: no rule is rewritten, but no proved rule says a state
so reached keeps the aggregates' rules, and the change numbers that tie an import's events to its rows' are checked by
no rule. The brief's decision 37 gives both; no move depends on either.

A fifth unnumbered point, not yet asked: since his answer of 2026-11-22 that adoption and the rule against renames bind
only from the first deploy he keeps, every push to `main` that passes CI deploys a `staging` stage by itself (the
architecture's "releases and deploys"). Whether a staging deploy is one he keeps, or is wiped like a preview's, is his
to decide.

| # | Question | Recommended in the brief | Changes | Where it is argued |
| --- | --- | --- | --- | --- |
| 21a | With Better Auth's organization writes closed, sign-up no longer founds an organization: does the operator found each one with `FoundOrganization` on `AdminApi`, for an account that exists, and who is its actor before any member row exists? (Asked when move 6 opens.) | | 21 | [the brief](BRIEF.md), decision 21 |
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
concept pages are written to be lifted into a skill's `references/` folder unchanged. The options he saw are not on
record here, nor is a recommendation.

### 2026-11-19 — use, not borrow

Question: does the app use the library, or take its ideas? Answer: "Not borrow use.", and "if possible find a way to
make use of ever single thing". (The packet's working rule from that, not his words: the default for every concept
is to use it, and "cannot yet" needs the exact blocker and what removes it.) This reverses the 2026-11-18 decision
"core" in [ideal-architecture](../ideal-architecture/DECISIONS.md), where it is recorded as "core, reversed". Reverse:
a new decision by him.

### 2026-11-19 — a save that changes nothing

Asked on today's contract, by dialog; built in commit `7b09ee4`. Question: how does the screen tell that a
save changed nothing? Answer: "Answer says 'no change'". It was the recommended option. The save's answer
says whether it changed anything, and the screen asks for the picture when it did not. Rejected: "Leave it until the
domain model"; "Always re-read after a save".

In the model (trial 13): an act that would leave its row as it is records nothing, and its receipt has no events, which
the screen reads as "no change" (`AnActThatChangesNothingLeavesTheImport`, `…LeavesTheRow`, proved). The question he
answered named "rows somebody else had just decided the same way"; what that leaves the second person with is decision 3.
Reverse: a new decision by him.

### 2026-11-19 — a confirm made on a draft somebody else has changed

Asked on today's contract, by dialog; built in commit `42c8303`. Question: what does Confirm do when the
other person has decided a row this screen has not shown yet? Answer: "Refuse, show, confirm again". It was the
recommended option. If the draft has moved on nothing is written, the screen shows what changed with its new totals, and
the person confirms again. His rule: nothing is confirmed that was not on screen, and nobody's decision is overwritten
at Confirm. Rejected: "Their decision stands"; "As today: your screen wins".

In the model (trial 13): the import numbers every change. The confirm names the last change its screen has received with
none before it missing, the change its plan was built at, and what its button said; the import takes it only when both
numbers are its last, the plan does what was shown, and no group act is being sent (`AConfirmNamesEveryChange`,
`APlanIsOfEveryChange`, `APlanDoesWhatWasShown`, `NothingEndsAReviewWhileAGroupIsSent`, proved). In the model he later
chose (the seventh round, `review15`) a group is one act and is never "being sent": the first three rules are proved
there too, and the fourth is not in it. The rule for the number a screen may name ran as a property, on a copy of the
rule written in the test and not on the screen's code. That the screen sends Confirm only after its own acts came back,
and that the handler builds the plan from rows written up to that change, are tests to write: not run. Reverse: a new
decision by him.

### 2026-11-20 — rows that wait unsaved when the page is reloaded

Asked on today's review saving, by dialog; built in commit `fa83274`. Question: a save failed, rows wait
unsaved, and the person reloads: what becomes of them? Answer: "Keep them and send them". It was the recommended option.
The waiting rows come back after a reload marked not saved yet and are sent again; the browser asks before the page is
left while rows wait. His rule: a decision the person made is either on the server or still waiting, never neither.
Rejected: "Warn before leaving only"; "Drop them and say which".

In the model: the queue of the person's acts the server has not answered is kept in the saved progress, each act with
its step and command id, so a resend answers the first receipt. Reverse: a new decision by him.

### 2026-11-20 — rows that wait unsaved when somebody else confirms the import

Asked on today's review saving, by dialog; built in commit `fa83274`. Question: rows wait unsaved and
someone else confirms the import: what becomes of them? Answer: "Name the rows, then drop them". It was the recommended
option. Nothing is sent to the closed import; the result says which rows the person had decided that were not part of
the confirm, with what they had decided. Rejected: "Drop them without a word".

In the model: the queue sends nothing once the import is confirmed, and an act already on its way is refused with
`NotOpen` (`ARowIsDecidedOnlyOnAnOpenImport`, proved). The naming is the screen's. Reverse: a new decision by him.

### 2026-11-20 — an accept that waits while its field's column is matched again

Asked on today's review saving, by dialog; built in commit `fa83274`. Question: what happens to that
accept? Answer: "Server refuses, screen says so". It was the recommended option. An accept made on an older
matching is not applied, the row shows the new proposal as open, and the screen says which accepts were taken back.
Rejected: "Screen drops it only"; "As today".

In the model (trial 13): every act names the import's matching it was made on, and is refused with `MatchedSince` if any
column was matched since (`AnActIsMadeOnTheMatchingNow`, proved); the screen sends it again without the parts whose
field was matched since. Each part of a decision's text keeps the matching it was made on, and the import's events hold
every field's column at every match, so every reader can tell whether a stored part still holds (tested, not run).
Reverse: a new decision by him.

### 2026-11-20 to 2026-11-22 — his later answers on saving the review

Asked by dialog on today's contract and built in today's code, after commit `d7594bd`. Each is recorded in full in
`explorations/ideal-architecture/DECISIONS.md`, the entries that begin "atoms,". Each was the recommended
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
| A Replace or Keep-stored already saved on such an import, its field not matched again (2026-11-22) | Leave as made: the next match of that same field takes it back and names it | Take them all back once |
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

Asked by dialog from the brief as it stood. Each question and its options are the brief's. Of each: I chose; the agent
recommended the same. Reverse each: a new decision by him.

| # | Question | Options, the recommended one first | Answer |
| --- | --- | --- | --- |
| 1 | How does the app take what exists only on the library's `main`? | Pin one commit's preview build, with its tarballs kept in the repository; vendor the built source of one commit; follow the head of `main`, re-pinned at least weekly; wait for the release that has them | "Pin a commit, keep tarballs" |
| 2 | Two people decide the same row in the same moment. What does the second one see? | The same as for a row that waited: theirs is held, the row shows both with whose is whose, they pick one, and Confirm waits until they do; acts merge by field; the later act wins | "Same: hold, show both" |
| 3 | A person saves, for a row, the decision someone else already made there. Is it theirs too? | No: it changes nothing, and the answer says so, naming whose it is; yes: it is recorded over the other's as their own | "No, it stays Dana's" |
| 6 | The stored items changed since the screen was drawn, so Confirm would do something else than its button says. What happens? | It is refused, the screen shows the new counts, and the person confirms again; as today: it is confirmed, and the result says what it did | "Refuse, show, confirm again" |

What each leaves unproved is in the brief under its number: for 2, that the queue holds the act and Confirm waits; for
3, that the screen says whose the row is, and, under decision 7's later answer (a group is one unit), that "No, it stays
Dana's" and "Answer says 'no change'" hold only when the screen sends `covered: false` and leaves out of a group the
rows that already hold what it gives: no rule checks `covered`, and with it set a repeat is recorded as the sender's
unless the act also says it leaves the row reading as it reads (`asItReads`, under his later answer "No change, Ana's
undo applies", below) (the brief, decisions 3 and 7; not run); for 6, what the two digests cover. That condition was not
put to him with decision 7.

### 2026-11-22 — decisions 4, 13, 15 and 16 of the brief

A second round of the same dialog. From this round on, the question and options in each table are the brief's wording,
and the answer is the label he picked in the dialog. Of each: I chose; the agent recommended the same.
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

### 2026-11-22 — decisions 5, 10 and 12 of the brief, and 7 put to a trial first

A third round of the same dialog. Of each of the three: I chose; the agent recommended the same. Reverse each: a new
decision by him.

| # | Question | Options, the recommended one first | Answer |
| --- | --- | --- | --- |
| 5 | Do a confirm and a take-back stay one write? | The confirm and the take-back become facts on the import, and their writes land after; each stays one D1 write, and the import does not record the confirm | "Yes, fact first, writes after" |
| 10 | How deep does an undo reach on one row? | Every step, exactly, with everything below the first level sealed into one text; every step, with the undo sent by the server alone; every step, held in the row's state as a list; one level | "Every step, sealed history" |
| 12 | Can an undo reach past a confirm that stands? | No, for both: it is refused as decided before the last confirm; no for a row the confirm imported, yes for one it did not; yes: the decision is taken back and the item keeps the value | "No, refused for both" |

The label "Yes, fact first, writes after" picks the first option of 5: neither the confirm nor the take-back stays one
D1 write. With decision 5 he was told that it reverses the app's written rule that a confirm and a take-back are each
one atomic write, and that `docs/standards/undo.md` and `CLAUDE.md` are rewritten in the move that makes it so.

Decision 7, how an act on a group of rows is carried, was asked in the same round and was not answered then. Put to him
first, and recommended in the dialog, was to run the one-unit design as a trial before deciding; the brief as written
then recommended one act per row. He saw three options: "Trial the one-unit design first", "One act per row" and "One
unit, untested", and chose the trial. The reason he was given: one act per row is proved and takes 13 to 15 minutes for
6,000 rows, worked out, with Confirm waiting; the one-unit design had never been run, so its standing under Verify was
unknown. Decision 7 stayed open until that trial reported, and decisions 8, 9 and 41 with it; 7 and 8 were answered
after it (the entry "decisions 7 and 8 of the brief, after the one-unit trial").

### 2026-11-22 — decisions 11, 14, 17 and 19 of the brief

A fourth round of the same dialog. Of each: I chose; the agent recommended the same. Reverse each: a new decision by him.

| # | Question | Options, the recommended one first | Answer |
| --- | --- | --- | --- |
| 11 | A decision its maker took back lies under another's. When that one is undone, does it come back? | Yes: an undo puts back exactly what was under it, whose it was; no: what its maker took back while it lay under is passed over | "Yes, exactly what was under" |
| 14 | What is a keep of one of two rows, when someone decides the other row meanwhile? | The keep is one act on the kept row, and `review` leaves its rivals out by rule; one decision across the rows that share the SKU; as today, row by row | "One act on the kept row" |
| 17 | Is an item an aggregate whose rules Verify holds? | Yes: every item is its own instance, its record held as text; no: items stay rows that one batch writes per confirm | "Yes, each item an object" |
| 19 | What happens when a confirm's write keeps failing? | The import stays confirmed and the write keeps being retried; after it has failed for a set time, the server opens the import again | "Stay confirmed, keep retrying" |

His answer to 11 holds for single-row acts; for a group its maker took back, see the entry "an undo after a group, and
an undo behind a group" below.

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

Decision 37 was put to him with adoption by an `Adopt…` command. A second way exists at the pin: a client's `import`
of events already decided, which runs no decision and to which policies and sagas never react (the brief, decision 37;
not run). His answer, the outcome "Adopt at first touch", stands; which way is open (under "Open").

### 2026-11-22 — decision 35 of the brief, 57 to 59, and the rest at their move

The last round of the same dialog. Of each: I chose; the agent recommended the same. Reverse each: a new decision by him.

| # | Question | Options, the recommended one first | Answer |
| --- | --- | --- | --- |
| 35 | How does a stored state or event change shape? | By rule; always wipe | "By rule" |
| 57, 58, 59 | Three things from your "use every single thing" list can't be used yet, each for a stated reason. The brief counts one as done only once you accept it. Rivet: no Rivet control plane or pool runs on Cloudflare. CI on Alchemy Git: the package has no runner. Workflow files through the GitHub provider: nothing in the provider writes repository contents. Which do you want built anyway, rather than written down as "cannot yet"? (more than one could be chosen) | None: accept all three; Rivet; a CI runner for Alchemy Git; GitHub contents resource | "None: accept all three" |

Decisions 57, 58 and 59 were asked as one question. Each is accepted as "cannot yet", with what would remove its blocker
as the brief states it: for 57 a Rivet control plane the Worker can reach and a pool outside Cloudflare, for 58 a runner
the project builds, for 59 a resource over the contents API.

Decisions 41 to 56 and 60 to 62 were put to him together, and his answer was "At their move": he does not want them
now, and each is asked when its move opens. They stay under "Open". Decision 41 was among them and then fell away
with his answer to 7. The options he saw for that answer are not on record here.

### 2026-11-22 — decisions 7 and 8 of the brief, after the one-unit trial

Asked again by dialog once the one-unit design had run (trials 15 to 17 of the trial page). Of each: I chose; the agent
recommended the same. The recommendation for 7 had been one act per row before the trial and changed with it. Reverse
each: a new decision by him.

| # | Question | Options, the recommended one first | Answer |
| --- | --- | --- | --- |
| 7 | How is an act on a group of rows carried? | The group is decided as one unit; one act per row under the group's step, sent by a saga; both, a group under some size row by row and a larger one as a unit | "One unit per group" |
| 8 | Which group may be taken back? | Only the import's last group act; any group of one's own | "Only the last group act" |

What he was told with decision 7: 123 rules are proved, of the trial's model; one act for 6,000 rows took a median of
214 ms in local workerd; Confirm never waits for a group; a colleague's act made before the group reached their screen
is refused and shown again, on any row; Verify cannot check that the rows a group names are the ones the fix fits, and a
property over 50,000 generated sequences holds the reading of a row through its groups; the screen and the stored rows
that read through groups are not run. He later answered otherwise on the colleague's act: a waiting act on a row the
group does not touch is sent again by itself, and one on a row it touches is held and shown with both (the entry "a keep
and its rivals, a group taken back over a changed row, waiting acts, and where the search runs"). With decision 8 he was
told the one case in which taking back an earlier group is not exact: an accept pressed because that group had made the
proposal stays accepted.

What "the last group act" means, as it was put to him with decision 8: the last group still in force. "Ana's undo is
refused and says Dana's group came after. She can undo once Dana has undone hers, or decide those rows again." So undo
walks back through the groups: when the last group in force is taken back, the one before it is the last in force
again. The model of that is the trial page's sixth round (`review14`: `OnlyTheLastGroupInForceIsTakenBack`,
`ThenTheOneUnderItIsTheLastInForce`, proved).

The 214 ms was, each time, the first group act on a fresh import, on the model before the last-group rule (`review12`,
trial 17).

Decisions 9 (who may stop a group act) and 41 (how long a group act may take before it is decided as one unit) fell away
with his answer to 7 and were not asked: a group is one act.

Before these questions he was also told that the 93 rules of the final model stand but none of them says that an act is
taken, and that the 131 to 151 ms an act given with decision 4 was measured only on a row's first act.

### 2026-11-22 — what the proofs cover, and what the tests cover

Question: "Verify proves what must never happen. It does not prove that a valid act is actually recorded: a model that
recorded nothing would pass every rule. Today that half is held by tests: the stories, and 8 of 8 deliberately broken
variants each failing their rule. Is that enough?" Answer: "Yes, tests hold it, said plainly". I chose; the agent
recommended the same. The proofs cover what must never happen; the stories cover that each valid act is taken; the
documents and any page that shows the proofs say exactly that split. Rejected: "Trial a rule for it first". Reverse: a
new decision by him.

The eight broken variants named in the question (of `review12`) each removed a refusal and were caught by the prover
(`NotProved`): they show that the proofs break when a check is removed, which is the half of what must never happen. A
variant that records nothing proved every rule and was caught only by a story. On the model he chose (the trial page's
seventh round, `review15`) that each valid act is taken is held by its 46 stories, each of the eleven commands taken in
a story with its events asserted; on `review14`, before the no-change answer, each of its 11 mutants whose act records
nothing breaks no rule and fails at least one story.

### 2026-11-22 — an undo after a group, and an undo behind a group

Asked by dialog after his answers to 7 and 8. Of each: I chose; the agent recommended the same. Reverse each: a new
decision by him.

Question: his answer to decision 11 used the example of Ana leaving 12 rows out in one act, Dana typing a quantity on
row 14, Ana undoing, then Dana undoing, and he chose "Row 14 is left out again, as Ana had it", before choosing one unit
per group. With a group as one unit, Ana's act is a group, and once she has taken it back it gives no row anything, so
in that example row 14 ends undecided. Which is it? Options: "Undecided: Ana took it back (Recommended)"; "Left out
again, as Ana had it" (each row keeping its own copy of the group's decision underneath). Answer: "Undecided: Ana took
it back". A group its maker took back stays taken back for every row; undo stays exact for single-row acts, where it
puts back exactly what was under, with whose it was. That holds of the group's patch: a row someone changed over the
group keeps what its own decision holds, the group's effect included, until that decision is undone, so in the example
row 14 keeps it between Ana's undo and Dana's, as he chose later ("Row 14 stays whole", below); a press there that
changed nothing is nobody's ("No change, Ana's undo applies", below).

Question: the model refuses a colleague's decision on any row when a group landed that their screen had not received,
but not their undo of a row. Should the undo be refused too? Options: "Yes, refuse and show (Recommended)"; "No, let the
undo through". Answer: "Yes, refuse and show": the undo is refused, the screen shows the group, and they press undo
again if they still mean it.

### 2026-11-22 — the pin, the names, and what holds the rules' standing

Further answers by dialog on the same day. Reverse each: a new decision by him.

- **The pin.** The library's `main` is pinned at `734c27a`, 67 commits past the `dbfd0dd` every trial on the trial page
  ran on; no trial ran on `734c27a`. On it the model he chose is built and merged into main (`0c4c5e5`, not yet on the
  public remote; 135 rules proved, 7 searched, 11 reached, 47 stories, by the build's own report), and the per-row
  model on another branch, not in this repository, as the fallback (96 proved, 3 searched, by the build's own report).
  His
  words: "All I know is I want the latest version of alchemy. We will likely need to update effect & alchemy again
  before Wednesday comes." How often it moves, under decision 1: "In the repo, re-pin only when needed"; one pin's
  builds are 38.7 MB in the repository, measured. The options put with it, as the architecture's record gives them ([its
  DECISIONS.md](../ideal-architecture/DECISIONS.md), "Alchemy, where the pinned build is kept and how often it moves"):
  the files in the repository, moved only when needed; the files as release assets on GitHub; in the repository, moved
  often. Which was recommended is not on record here.
- **What is kept of what is deployed.** His words: "We can always tear down & redeploy from scratch. The idea is that we
  get our ideal version built. I don't care about anything we've deployed yet we can start from scratch so that we have
  the best names & things." So the rule that a model, an aggregate or an event is never renamed, and the adoption of
  rows already stored (decision 37), bind only from the first deploy he keeps.
- **Names.** Not his answer: proposed, and open until the first hosted deploy he keeps stores an event under them. The
  aggregates are `Import`, `Row` and `Group`, in the model `Catalog` with `CatalogApi`. The trial page's `ImportLife`,
  `RowUnit`, `GroupUnit`, `Review` and `ReviewApi` are these.
- **A rule that each command can happen.** Question: the library now has `sometimes` rules, which the search answers
  "reached" or "unreached"; does each command get one, beside the stories? Answer: "Yes, one per command". On the
  build's branch the eleven are reached, one for each command, by the build's own report; not run on any trial model.
  Options, as the architecture's record gives them: "Yes, one per command"; "Stories only" (put to him as a search,
  not a proof). Which was recommended is not on record. I chose.
- **What holds the standing of each rule.** Answer: "The library's lock file": the library's `lock` option records each
  rule's standing, in place of a list written by hand, once it is shown to catch a rule that slipped. Not yet run.
  Options, as the architecture's record gives them: "The library's lock file"; "Both"; "Keep the hand-written list".
  Which was recommended is not on record. I chose.
  Corrected later the same day: at the pin the lock keeps each rule's text, not its standing; his answer then, "Lock
  plus the library's proved list", is under "the lock file corrected, a press that changes nothing, a keep after an
  earlier decision, a waiting undo" below.
- **What is shown on Wednesday 2026-11-25.** Answer: "Chosen design, parked one as fallback": the model with a group as
  one unit is the one built for `main`; the per-row model stays on a branch as what is shown if the chosen one is not
  merged by Tuesday evening. As the architecture's record has it: if the chosen model is not checked and merged by the
  evening of 2026-11-24, he shows Verify on the per-row model from a local branch on his own machine, not in this
  repository, and says plainly that it is the alternative he did not choose; that branch is kept running on the pinned
  build and gets nothing else. The options he saw are not on record, nor is a recommendation. I chose.
- **Where decision 34's search runs in CI** (34a): answered later the same day, under "a keep and its rivals, a group
  taken back over a changed row, waiting acts, and where the search runs" below.

For Wednesday neither the options he saw nor a recommendation is on record; for the other two, no recommendation is.

### 2026-11-22 — a keep and its rivals, a group taken back over a changed row, waiting acts, and where the search runs

Further answers by dialog on the same day. Of each but 34a: I chose; the agent recommended the same. Of 34a: I chose;
which was recommended is not on record. Reverse each: a new decision by him.

**Deciding a rival** (14a under decision 14). Question: rows 4 and 10 share a SKU; Ana keeps row 4, which leaves row 10
out by rule; Dana, seeing that, decides row 10 herself anyway; does her decision win over the keep? Options: "Yes, and
a clash is shown again" (Recommended); "No, the keep holds" (her act refused with "row 4 was kept by Ana"). Answer:
"Yes, and a clash is shown again": row 10 takes her decision; if that leaves two kept rows with one SKU, the review
flags the clash again as needing a decision, and neither row imports until someone settles it.

**Two keeps at once** (14b under decision 14). Question: in the same moment Ana keeps row 4 and Dana keeps row 10,
neither having seen the other's; as modelled both are taken and both rows end up left out, which neither chose.
Options: "Both kept, clash shown again" (Recommended); "Second keep refused" (a rule reading both rows, not run); "Both
left out, as modelled". Answer: "Both kept, clash shown again": both keeps are recorded, the review sees two kept rows
with one SKU and flags the clash, naming both people; no row is left out that nobody chose to leave out. The question
and its third option are recorded as he saw them; "as modelled" there is only half true: `review14` takes both keeps as
row acts, and the leave-out of both rows was the brief's written rule for `review`, which no model contains and which
did not run.

So under decision 14 a decision someone makes on a rival after the keep wins over the keep, with a clash shown when it
would import both rows with one SKU, and two keeps of one SKU are a clash, not two leave-outs. Whether an accept made
on a rival after the keep counts as such a decision was not asked and is open ("Open", above). That
changes the rule `review` applies to rivals; it is in no model and not run. His later answer, "As today, never
overwrite a choice" (under "the lock file corrected, a press that changes nothing, a keep after an earlier decision, a
waiting undo" below), is of the other order, a rival decided before the keep: one whose decision made before the keep
is only accepted fixes, a person's or a group's, is left out by the keep; one kept or edited before it is not
overwritten, and the clash is shown.

**Group undo, changed row.** Question: Ana accepts a fix for 12 rows; Dana types a quantity on row 14 on top of it; Ana
undoes her group; the model leaves row 14 with Dana's whole decision, the group's fix included, where today's app strips
the group's fix. Options: "Row 14 stays whole" (Recommended); "Strip the group's part". Answer: "Row 14 stays whole":
her decision stands as she made it, and the screen names it ("Row 14 was changed by Dana and stays"). So where the
reading of a row through its groups differs from today's `act` on such a row, the model's reading is the one chosen;
today's `act` changes at the move that puts the review on the model.

**Waiting acts and a group.** Question: he had been told, with decision 7, that a colleague's group makes every act from
a screen that has not received it "refused and shown again, on any row"; the brief says a waiting act on a row the
group does not touch is sent again by itself, and one on a row it touches is held and shown with both. Which? Options:
"Yes: resend untouched, hold touched" (Recommended); "Show every refused act again". Answer: "Yes: resend untouched,
hold touched". Not run.

**Where each model's search runs in CI** (34a under decision 34). Question: where in CI does each model's search run?
Answer: "Own job + nightly, no new infrastructure". Rejected: "Also replay from your remote cache"; "Full copy of
beep-effect's tiers". Which of the three was recommended is not on record here.

Two notes:

- Founding an organization (21a under decision 21) stays open, to be asked when move 6 opens, as he chose for the
  decisions that wait for their move. Nothing is recommended beyond his earlier infra answer I8, "Close sign-up; I add
  accounts".
- He was not told, when he answered decision 39 (what is kept for ever), that each act on a group is an object kept for
  ever, taken back or not, with its rows' text. He is to be told.

### 2026-11-22 — the lock file corrected, a press that changes nothing, a keep after an earlier decision, a waiting undo

Further answers by dialog on the same day. Of each: I chose; the agent recommended the same. Reverse each: a new
decision by him.

**Lock file.** A correction of his answer "The library's lock file" (under "the pin, the names, and what holds the
rules' standing" above), which stays recorded as it was. Question: he had chosen the library's lock file to hold each
rule's standing; at the pin `734c27a` the lock keeps each rule's text, not its standing, so a rule that slips from
proved to checked with its text unchanged passes the lock, and the library holds standing with `require.proved`, a list
of rule names. Options: "Lock plus the library's proved list" (Recommended); "Lock plus our own list"; "Lock only".
Answer: "Lock plus the library's proved list": the lock catches a rule removed or reworded; `require.proved` fails the
build when a named rule is no longer proved; no hand-written assertions.

What follows from it, as the library at the pin and the build's branch show it (the branch's figures by the build's own
report):

- The lock and `require` are options of Verify's reports only: `Verify.report` and `Verify.model` over a model, and
  `Verify.aggregate`. `Prove.report` (an aggregate) and `Prove.decisionReport` (a decision) take the source file, and
  for an aggregate the decisions that record on it; neither takes a lock or a list.
- In `bun run check` the `prove` task runs five tests: the import's own 37 rules for each of its seven commands under
  `Prove.report(Import)`, and each of `Deciding`, `Undoing`, `DecidingGroup` and `UndoingGroup` under
  `Prove.decisionReport`. Each fails on any rule its report does not give as proved, whatever its name, with what the
  solver found. A decision's test holds its count of paths, that every state it leaves fits its aggregate's schema,
  that some state lets it record, and that the prover read every check. Which rules there
  are is not checked there: in `bun run check` a rule that slips is caught by the report itself, and a rule taken out of
  a decision or renamed is not caught; the lock catches it, in `check:full`, CI's `proofs` job and the nightly run. The
  lists of rule names written by hand (`packages/catalog/model/test/rules.ts`) are on the per-row model's branch only,
  which is not in this repository.
- The lock acts in `check:full`, CI's `proofs` job and the nightly run, where `Catalog.verify.test.ts` runs
  `Verify.report` over `Catalog` with `lock: "./Catalog.lock.json"` and fails on a rule the lock holds differently or a
  rule relocked. On the build's branch as it stands, that test passes `require.proved`, with every rule the lock keeps
  of the kinds a proof covers (135, by the build's own report), in place of the assertion by kind it had before.
- The check that every decision recording on a row or a group states that aggregate's three rules on who may change
  it: on the build's branch each of the four decision proofs calls `missingRules`, which fails, naming the decision,
  when one leaves out the three rules, by the build's own report. It was removed with the hand-written lists and then
  restored; his answer did not name it (under "Open").

**Press that changed nothing.** Question: Ana's group leaves 12 rows out; Dana presses something on row 14 that changes
nothing, because the row already reads that way through the group; Ana undoes her group; as written, row 14 stays left
out and the screen says Dana changed it. Options: "No change, Ana's undo applies" (Recommended); "Dana's press stands".
Answer: "No change, Ana's undo applies": Dana's press is answered "no change" and is not recorded as hers, as decision 3
has it; after Ana's undo row 14 is undecided like the other 11. "Row 14 stays whole" holds only for a press that changed
the row. So a row's act carries what its sender says of the reading (`asItReads`: the act leaves the row reading as it
reads now through its groups), as it carries `covered`, and such an act records nothing. The trial model `review15`
makes that change, its results on the trial page's seventh round, and takes that exit only after the checks of the
decision the sender saw on the row and of the matching, so a press from a screen that missed a later decision there,
or one made on an older matching, is refused and held, as decision 2 has it, not answered "no change". No rule holds
that order. Its saw half is held by one story ("a press over a group from a screen that missed a later decision on the
row is refused and held, not answered no change") and its matching half by another ("a press over a group made on an
older matching is refused and held, not answered no change"), each shown by its own mutant, which the prover still
proves: with the exit put back ahead of the check of what the sender saw, every rule is still proved and both stories
fail; with it moved between the two checks, every rule is still proved and only the matching story fails. On
`review15` the row's act has 284 paths and 135 rules are proved, with 46 stories. No rule checks what the sender says.
On the build's branch `Deciding.decision.ts` has the same exit, taken after the checks of the decision the sender saw
and of the matching, by the build's own report; as read, that branch has the saw story but not the matching story, nor
a mutant that puts the exit between the two checks, and the build is to carry both.

**Keep vs earlier** (decision 14a's other order, under decision 14). Question: row 10 already had a decision before Ana
keeps row 4: does the keep leave it out? Options: "As today, never overwrite a choice" (Recommended); "Any earlier
decision is a clash". Answer: "As today, never overwrite a choice": a rival whose decision was only accepted fixes, by a
person or by a group, is left out by the keep, as today; a rival someone deliberately kept or edited is not overwritten:
the clash is shown, naming both people, and neither row imports until it is settled. It is the other order from 14a
above, a rival decided before the keep, and leaves 14a as it was for a decision made after the keep; whether an
accept made on a rival after the keep counts there stays open ("Open", above). It changes the rule `review` applies
to rivals (decision 14 of the brief has the three cases). In no model and not run.

**Waiting undo.** Question: when a colleague's group lands, what happens to a waiting undo on a row the group does not
touch? Options: "Sent again by itself" (Recommended); "Ask to press undo again". Answer: "Sent again by itself"; only an
undo on a row the group touched is held and shown. So his earlier "Yes, refuse and show" for an undo behind a group
(under "an undo after a group, and an undo behind a group" above) asks the person to press undo again only on a row the
group touched. Not run.
