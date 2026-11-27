---
type: Goal
title: Focus and friction
description: The repository is put back in front of the person it is for. A person who did not build the import uses it on their own spreadsheet, a failing check says in one place what to fix, a small change is checked in seconds, a merge needs nobody watching, and the worktrees and standing files say where things are.
status: active
from: explorations/ideal-architecture
---

# Focus and friction

On 2026-11-26 Benjamin asked what the agent liked and disliked about the repository. It answered that the import's
rules and their enforcement are its strength. The risk it named was more effort going into the machinery than into
putting the import in front of the people it is for. His answer was "Lets make a new goal packet to address all of
this". [PLAN.md](PLAN.md) has the steps and the measurements each one starts from.

**Where it comes from.** A goal is made when an exploration graduates. Like [quality](../quality/SPEC.md), this one
is an exception he asked for. It comes from a review in a working session, not from a brief. `from` names
`ideal-architecture` because the checks, the laws and the repository's shape that steps 4 to 9 change rest on it.
Steps 2 and 3 rest on no exploration; it rests on the product rule in `CLAUDE.md` that the person's experience comes first.

## Objective

1. **A person who did not build the import uses it on a file of their own**, and what they did and where they stopped
   is written down as observations and counts. Each thing that went wrong becomes a question for Benjamin or a fix.
2. **Machinery waits for that person.** Until objective 1 is recorded, the kinds of work Benjamin names wait (step 2,
   his ruling).
3. **`CLAUDE.md` is an index an agent reads in one go.** It holds what the app is, the import's rules and pointers;
   the commands, the laws and the type-check's rules live under `docs/`. On 2026-11-26 it was 796 lines and 12,434
   words, and the row for `bun run check` alone was 424 words. [Quality](../quality/SPEC.md), step 3, already holds
   "under 400 lines"; which goal owns it, and to what length, is step 4's decision.
4. **A failing `bun run check` ends with one summary**: each law that failed, the file and line, and what to write
   instead, after turbo's own output, so nobody scrolls back through 33 tasks.
5. **A small change is checked in seconds before a commit.** `bun run check:changed` runs the laws on the files
   changed since the merge base and the type-check and fast tests of the packages they affect. `bun run check` stays
   the gate before every push.
6. **A merge needs nobody watching.** When Benjamin says "merge it", the pull request merges itself once the required
   checks pass. On 2026-11-26 the repository did not allow auto-merge (`allow_auto_merge: false`) and kept merged
   branches (`delete_branch_on_merge: false`).
7. **The worktrees and checkouts say what they hold.** On 2026-11-26 there were 55 worktrees. 13 were on a branch, 8
   of those branches were already in main, and the other 42 were detached, 15 of them under the session cache of one
   earlier session. The main checkout was on `docs/alchemy-uptake-goal` with uncommitted changes. Where this
   repository's worktrees go (`.claude/worktrees/`) is written in `CLAUDE.md`.

## Non-goals

- No rule of the import changes. A rule that the person in step 3 shows to be wrong is a question for Benjamin, put to
  him with what they did.
- No law is weakened or dropped. Objective 4 changes what a failure prints; objective 5 adds a faster run beside
  `bun run check` and never replaces it.
- No deploy, release or push to `main` by an agent. If objective 1 needs a hosted stage, the deploy is Benjamin's
  (`goals/infra/PLAN.md`).
- No file of the person in step 3, no part of it and no name of theirs is committed, pasted into a transcript, or
  stored outside their own copy.
- No worktree is removed without Benjamin's yes. A worktree with uncommitted changes or a branch not in main may be
  another session's work.

## Constraints

- One pull request per step, which the agent opens and sees to mergeable. Benjamin merges, or says "merge it".
- `bun run check` passes before every commit. The ledgers, the baselines and the strict ceilings only fall.
- The moved text of `CLAUDE.md` keeps every rule word for word. A rule moves and a link takes its place. A rule that
  should change is a question for Benjamin, not part of the move.
- The summary and `check:changed` are commands of `@beep/repo-cli` (`bun run beep ...`). The schema of a finding
  comes first, then the service, then the code (`docs/standards/schema-first.md`).
- Every document touched stays an Open Knowledge Format document (`bun run docs:check`).

## Acceptance

- [ ] [PLAN.md](PLAN.md), "The person's session", holds at least one session with someone who did not build the
      import, on a file of their own. It records what they did, where they stopped, and the counts the screen showed,
      and holds no file content and no name. Each problem it found is a fix merged or a question answered in the root
      `DECISIONS.md`.
- [x] Benjamin's ruling on what waits (step 2) is in the exploration's `DECISIONS.md`; it ends when step 3 is
      recorded.
- [ ] `wc -l CLAUDE.md` is at most the length Benjamin chose in step 4, `bun run docs:check` passes, and every rule
      that left the file is found word for word under `docs/` (a check in the step's pull request lists them).
- [x] Breaking one law in a scratch commit (`??` in a model file), then running `bun run check`, ends with a summary
      that names `defaults`, the file and line, and what to write. A test of the summary command feeds it two laws'
      failures.
- [x] `bun run check:changed` on a one-file change in one package finishes in the time PLAN records as the target, and
      fails on the same scratch commit as above.
- [ ] `gh api repos/kriegcloud/inventory-import --jq .allow_auto_merge` prints `true`, if Benjamin turns it on, and
      a pull request merged that way is named in PLAN.
- [ ] `git worktree list` shows no clean worktree whose branch is in main. PLAN lists every worktree left, with its
      reason. `CLAUDE.md` says where this repository's worktrees go.
- [ ] `bun run check:full` passes on `main` after the last merge, and this goal's `status` is `done` with its closing
      note.

## Decisions

All seven were answered on 2026-11-26, each as recommended:
[the exploration's decisions](../../explorations/ideal-architecture/DECISIONS.md), "2026-11-26 — focus and friction".
[PLAN.md](PLAN.md), "Decided 2026-11-26", says what each changes. Questions that come up later are logged there too.
