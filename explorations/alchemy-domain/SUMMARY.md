---
type: Brief
title: "Summary: the app on @alchemy.run/domain"
description: The brief on one page, for Benjamin to approve or correct. It covers what changes for the person and what stays, the four goals and eleven moves, what he decided, what is still open, the costs he accepts, and the sentence he approves.
---

# Summary: the app on `@alchemy.run/domain`

[The brief](BRIEF.md) on one page, to approve or correct. Numbers in brackets are decisions in the brief and
[DECISIONS.md](DECISIONS.md). Figures are counted on main at `985b3e6`.

Two meanings of "model": **the model** is the review written in `@alchemy.run/domain`; **model calls** are the AI
calls the app makes today, 40 a day per organization.

## What the person will notice

Every write that decides something becomes a command to the model, and the library's prover, Verify, reads its rules.
As you required ("Yes, tests hold it, said plainly"), the proofs cover what must never happen, and the stories cover
that each valid act is taken. Of the lock's rules, 8 are only searched and 11 only reached, not proved.

Rules, counts and sentences stay as they are, except where an answer names a change. The main ones are listed below;
the brief's No-gos list every decision that names one. You picked 2, 7, 8, 14a, 14b, "As today, never overwrite a
choice" and "Row 14 stays whole" as recommended before you had the picture of several people on one import. They stand
under your standing rule, and each can be reversed by a new decision.

- A press from a screen that is behind is never silently dropped or applied: it is held and shown (2, your standing
  rule). An act made before a confirm that arrives after a reopen is refused, named and dropped ("No, name it and drop
  it", 13), and so are rows still waiting when someone else confirms ("Name the rows, then drop them").
- A group of rows is saved at once as one unit. Only the import's last group act can be taken back (7, 8).
- After a confirm, the Result step says "Writing your items" and counts up. Items arrive over minutes, so the Items page
  can show part of an import. A take-back goes item by item and names what it kept (5, 17).
- A confirm is refused when the stored items changed since the screen was drawn. The person sees the new counts and
  confirms again (6).
- An undo of a decision made before a confirm that stands is refused. The row can be decided again instead (12).
- Rivals for one SKU:
  - A decision made on a rival after a keep wins over the keep. If that leaves two kept rows with one SKU, the clash
    is shown again (14a). An accepted fix does not count as such a decision.
  - Two keeps at once are a clash, not two leave-outs (14b).
  - A keep does not overwrite a rival that someone kept or edited earlier ("As today, never overwrite a choice").
- When a group is undone, a row someone changed on top of it keeps their whole decision ("Row 14 stays whole").
- If a confirm's write keeps failing, the Result step says "still being written, nothing is lost" (19).
- A person demoted from editor can still decide rows for a moment, until their session's role catches up (20).
- Sign-up and "Create your organization" no longer found an organization; who does is 21a, still open (21).
- The 40 model calls come "back at midnight UTC", so up to 80 fit in the two minutes across midnight (25).

## Goals and moves

Each move leaves a working app. Move 0's pin and move 1 are on main. Move 0's check, a clean install from the kept
files with the library's registry refused in `check:full`, is still to write. Nothing the app runs calls the model yet.

- **domain-core:** 0, the library pinned at its unreleased `main@734c27a`; 1, the review's model in memory (164 rules
  in its lock, 145 of the kinds a proof covers, 66 stories, 192 mutants, which are deliberate breaks a proof or story
  must catch); 2, the model's Worker, with the day's model calls counted through it.
- **domain-import:** 3, the review saved through the model; 4, the Items page; 5, uploads, suggestions, lists, history.
- **domain-access:** 6, organizations and members.
- **domain-extras:** 7, the day's count on Effect Cluster (a pool of Durable Objects with its own Worker); 8, mail, channel, Discord, scores; 9, the operator's surface; 10, history and mirror.

## What else you decided

All on 2026-11-22 unless marked:

- "Not borrow use." (2026-11-19).
- An import, plus one record for each decided row (4).
- Two Workers (29).
- "Start empty": nothing stored today is carried in (37).
- Your standing rule, "Keep it, stop asking me". DECISIONS.md lists the cases it settles, for you to overrule.

## Still open

- **21a:** who founds an organization. Asked when move 6 opens.
- **The later decisions**, each asked when its move opens:

  | Move | Decisions |
  | --- | --- |
  | 3 to 5 | 56 |
  | 4 | 42 |
  | 5 | 43, 44 |
  | 8 | 45 to 49, 52, 53, 60 to 62 |
  | 9 | 50, 51, 54 |
  | 10 | 55 |

- **Staging:** whether a staging deploy is kept or wiped. Two things rest on it: whether move 7 carries the day's count
  across, and whether it matters that suggestions start empty at move 8.
- **The names:** `Import`, `Row`, `Group`, `Catalog` and `CatalogApi` are proposed, not chosen. They stay open until
  the first hosted deploy you keep, and are never renamed after it.

## Costs and gaps you accept

- **The pin:** the library is pinned to an unreleased commit, with two patches of ours not yet reported upstream.
  Its registry deletes a commit's build a week after `main` moves on, so the trials cannot be installed from it again.
- **The proof margin is thin:** how a check is written can cost a proved rule; past 4,096 paths a decision proves
  nothing.
- **One atomic write:** decision 5 reverses the written rule; `undo.md` and `CLAUDE.md` are rewritten in move 3.
  - "Nothing is confirmed that was not on screen" is proved.
  - Two halves of it are left to tests: that the screen names the last change and digests what it draws, and that the
    handler plans from rows written up to that number (a slow test, not run).
- **Not held by the model** (not run):
  - Nothing makes a take-back wait for the confirm's items.
  - The import's counts are the numbers the handler stated. Once another import creates a row's item, what is stored
    differs from them, and no command corrects them.
- **Still plain database writes:** the upload's pieces, the confirm's plan, the projections' batches (the D1 tables
  written from the model's events), suggestions until move 8, and Better Auth's accounts and sessions.
- **Cluster (27, move 7):** the pool is reached through a public gateway behind one token, which cannot be turned off,
  and a value kept there is at most 2 MiB. Move 7 needs you to accept that gateway and its token.
- **"Cannot yet", accepted (57 to 59):** Rivet, CI on Alchemy Git, and workflow files through the GitHub provider.
- **Kept for ever** (39), as the library keeps it, until an operator's command deletes an organization's objects when
  it leaves:
  - one object for each decided row, each item, and the import, with one projection key per item;
  - their directory objects: about 274 for the items alone, the rows' and the groups' not counted;
  - one object for each group act, taken back or not, holding its rows' text (up to 600,000 characters);
  - a removed member's email, in the events that added them.
- **One 50,000-row file** (worked out, not measured):
  - Every row decided alone: about 594,000 to at least 771,000 requests, so at most 1.3 to 1.7 files a month inside
    the included million of Workers Paid (Cloudflare's paid plan), then about $0.09 to $0.12 a file; the row acts take 109 to 126 minutes in turn.
  - One row in five alone, the rest by groups: the items' 193,750 to at least 271,250 requests dominate.
  - At least 852,500 rows written for the items, not worked out against the 50 million a month included.

## What you approve

The sentence is "The brief matches." Saying it opens `domain-core` and starts move 2. By hand, move 2 needs your
Cloudflare login, `alchemy state bootstrap`, a test stage you deploy, and the pin widened to `@alchemy.run/better-auth`
and `@alchemy.run/test`, a re-pin you ask for. Whether those two are published at `734c27a` was not checked.
