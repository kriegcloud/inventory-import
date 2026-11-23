---
type: Brief
title: "Summary: the app on @alchemy.run/domain"
description: The brief on one page, for Benjamin to approve or correct. It covers what the person notices, the four goals and eleven moves, what he decided, what is still open, the costs he accepts, and the sentence he approves.
---

# Summary: the app on `@alchemy.run/domain`

[The brief](BRIEF.md) on one page, for you to approve or correct. Figures are counted on main at `12fba2c`.

## What the person notices

The import's rules, counts and sentences stay the same. Underneath, every write that decides something (review acts,
match, confirm, take-back, items, the day's model calls, members) becomes a command to a model. The library's prover,
Verify, proves the model's rules from its code; today, tests check samples. When two people work on one import, a
press from a screen that is behind is held and shown, never lost. After a confirm, the Result step says "Writing your
items" until the items are stored.

## Goals and moves

Each move leaves a working app. Moves 0 and 1 are done and on main. Nothing the app runs calls the model yet.

- **domain-core**
  - 0: the library pinned at its unreleased `main@734c27a`, installed and type-checked.
  - 1: the review's model, in memory: 164 rules in its lock (145 of the kinds a proof covers), 66 stories, and 192
    mutants (deliberate breaks a proof or story must catch).
  - 2: the model's own Worker; the 40 daily model calls are counted through it.
- **domain-import**
  - 3: the review saved through the model, shown working in two browsers.
  - 4: the Items page answered by queries; an edit is a command.
  - 5: uploads, suggestions, the lists, and an import's history built from the model's own events.
- **domain-access**
  - 6: people and roles; "an organization keeps an admin" is proved.
- **domain-extras**
  - 7: the daily count moves to Effect Cluster, with its nightly job.
  - 8: mail, a team channel, Discord sign-in, confidence scores.
  - 9: the operator's command line, an MCP server and analytics.
  - 10: a history of confirmed imports in Alchemy Git.

## What you decided

- "Not borrow use." (2026-11-19).
- On 2026-11-22:
  - An import, plus one record for each decided row (decision 4).
  - A group of rows is one unit; only the last group act can be taken back (7, 8).
  - Each item is its own record; a confirm writes from a plan staged in the database (17, 18).
  - Two Workers (29).
  - "Start empty": nothing stored today is carried over (37).
  - Your standing rule, "Keep it, stop asking me": a press from a screen that is behind is held and shown. The cases it
    settles are in DECISIONS.md for you to overrule.

## Still open

- 21a: who founds an organization. Asked at move 6.
- These are asked when their move opens:

  | Move | Decisions |
  | --- | --- |
  | 3 to 5 | 56 |
  | 4 | 42 |
  | 5 | 43, 44 |
  | 8 | 45 to 49, 52, 53, 60 to 62 |
  | 9 | 50, 51, 54 |
  | 10 | 55 |

- Whether a staging deploy is kept. That decides whether move 7 carries the daily count across, and whether move 8's
  empty suggestions matter.

## Costs you accept

- **The pin:** the library is pinned to an unreleased commit with two patches of ours, neither reported upstream yet.
- **The registry:** it deletes a commit's build a week after `main` moves on, so the earlier trials cannot be installed
  again. The pin itself is kept in the repository.
- **Not proved:** uploads, the confirm's plan and the projections stay plain database writes. A confirm's items land
  just after it, so "confirm only what was on screen" is tested, not proved. The screen's queue is tested. The 8 rules
  across records are searched, not proved.
- **A 50,000-row file** (worked out, not measured):
  - Every row decided alone: about 594,000 to 771,000 requests. That is 1.3 to 1.7 files a month inside Workers Paid's
    included million, then about $0.09 to $0.12 a file.
  - Rows decided in groups: creating the 38,750 items (193,750 requests or more) dominates.

## What you approve

The sentence is "The brief matches." When you say it, `domain-core` opens and move 2 starts: the model's Worker, with
the day's model calls counted through it.
