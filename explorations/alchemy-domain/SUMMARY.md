---
type: Brief
title: "Summary: the app on @alchemy.run/domain"
description: The brief on one page, for Benjamin to approve or correct, pointing to the sections of the brief and DECISIONS.md that hold each full list.
---

# Summary: the app on `@alchemy.run/domain`

[The brief](BRIEF.md) on one page, to approve or correct. Figures are counted on main at `84375c3`.

**The model** is the app's deciding writes (review, confirm, items, the AI-call allowance, membership) as commands
whose rules the library's prover, Verify, reads. **Model calls** are the AI calls the app makes today, 40 a day.

## What changes for the person

Rules, counts and sentences stay as they are, except where an answer names a change; the brief's No-gos list those
decisions. The largest:

- Items arrive over minutes after a confirm (17).
- The day's model calls come back at midnight UTC (25).
- Sign-up no longer founds an organization (21).

A press from a screen that is behind is never silently dropped or applied: it is held and shown.

## The moves

Eleven moves (0 to 10) in four goals, each leaving a working app. Move 1, the review's model in memory, is on main,
with 164 rules in its lock. The proofs cover what must never happen, and the stories cover that each valid act
is taken, as you required. Eight rules are only searched over sequences, not proved, and eleven only show that an act can happen. Move 0's pin is
on main, but its check is still to write. Nothing the app runs uses the model yet.

## What you decided

Decisions 1 to 40 are answered, apart from 9 (fell away) and 24 (an earlier answer stands): [DECISIONS.md](DECISIONS.md),
"Answered". Your standing rule, "Keep it, stop asking me", settles every case of several people on one import; each is
listed under "Decided by the rule, for him to overrule".

Every answer you gave on 2026-11-22 about several people on one import was picked as recommended before you had the
full picture. DECISIONS.md marks each one, and each can be reversed by a new decision.

## Still open

- **21a**, who founds an organization, is asked when move 6 opens.
- **Decisions 42 to 56 and 60 to 62** are each asked when their move opens.
- **Staging:** whether a staging deploy is kept or wiped (DECISIONS.md, "Open").
- **The names** stay open until the first hosted deploy you keep, and are never renamed after it.

## Costs you accept

- **The pin:** an unreleased commit, with two patches of ours; the registry deletes old builds.
- **Not proved:** some rules rest on SQL or tests; the brief names each.
- **Kept for ever:** each decided row, each group act with its rows' text, and each item, among other objects
  (decision 39).
- **Cluster:** Effect Cluster's pool sits behind a public gateway with one token (decision 27).
- **Cannot yet:** three things you asked for (57 to 59).
- **One 50,000-row file**, every row decided alone: about 594,000 to at least 771,000 requests (worked out, not
  measured), so at most 1.3 to 1.7 such files a month within Workers Paid's included million. The brief's "What one
  large import costs" has the rest.

## What you approve

The sentence is "The brief matches." It first finishes move 0: its clean install from the kept files, with the
library's registry refused, in `check:full`. Then move 2: the model's Worker, counting the day's model calls. By hand,
it needs your Cloudflare login, `alchemy state bootstrap`, a test stage you deploy,
and the pin widened to `@alchemy.run/better-auth` and `@alchemy.run/test`.
