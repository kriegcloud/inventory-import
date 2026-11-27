---
type: Plan
title: Focus and friction, plan
description: The steps that put the import in front of a person who did not build it, make a failing or small check cheap to read and run, let a merge finish on its own, and clear the worktrees, each with what it starts from and what is Benjamin's to decide.
from: explorations/ideal-architecture
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance. Status is one of `todo`, `doing`, `done`. A step is done when its
pull request is merged, or, for a step with none, when its record below is written.

| # | Step | Pull request | Status |
| --- | --- | --- | --- |
| 1 | This packet | | doing |
| 2 | Benjamin's ruling on what waits for the person's session | none: a decision | done: 2026-11-26 (below) |
| 3 | The person's session: prepared, run by Benjamin, written down | one for the record | todo |
| 4 | `CLAUDE.md` as an index: which goal owns it, to what length, then the move | one | todo |
| 5 | Measure `bun run check`: how long, and what a failure prints | none: a record below | todo |
| 6 | One summary at the end of a failing check | one | todo |
| 7 | `bun run check:changed` | one | todo |
| 8 | A merge that finishes on its own | none, or one for the rule in `CLAUDE.md` | todo |
| 9 | The worktrees and the main checkout | one for `CLAUDE.md` | todo |
| 10 | Close: the closing note, `status: done`, `bun run check:full` on main | one | todo |

Every question was answered on 2026-11-26 ("Decided", below). Steps 4, 5, 7 and 9 can start at once, and step 6
after step 5. Step 8 waits on Benjamin's change to the settings, and step 3 on a person he brings.

## 2. What waits

**Found.** On 2026-11-26 the repository had 33 tasks in `bun run check`, an ERP ontology with an OWL reasoner, the
Alchemy packages kept as files with their own patches, nightly mutants and seven ledgers. Each is well made. The agent
could not name the customer decision that `goals/party-slice`, merged that day, unblocks. No session with a person
who did not build the import is recorded anywhere in `goals/`, `docs/qa/` or the root `DECISIONS.md`.

**To do.** Put the ruling to him and write it down with the date it ends.

## 3. The person's session

**To do.** The agent prepares and Benjamin runs it:

- a page for whoever sits down: what the app is for, in two sentences, and nothing about how it works;
- what to watch for, taken from the import's rules in `CLAUDE.md`: where they stop, what they read aloud, whether the
  counts on screen match what they expected from their file, whether they find the rows left out and why;
- a record to fill in: the steps reached, the counts the screen showed (rows read, Ready, Needs a decision, Cannot
  import, imported), each place they stopped and what they said.

The file stays theirs. The record holds counts and observations, never a value, a heading or a name from it. Where
the session runs (Benjamin's machine with `bun run dev`, or a hosted stage he deploys) is his.

## 4. `CLAUDE.md`

**Found.** 796 lines and 12,434 words on 2026-11-26, up from 775 lines when [quality](../quality/PLAN.md) measured
it. The row for `bun run check` is one table cell of 424 words. "What fails the check" and the commands table are
the longest sections. Quality's step 3 already holds "under 400 lines" and is `todo`.

**To do.** After his answer, move text out word for word, with a link in its place: the commands to
`docs/commands.md`, the laws and the type-check's rules to `docs/laws.md` (or under `docs/standards/`, if he prefers
quality's place), and the layout to `docs/architecture.md`, which exists. What stays: what the app is, how we work, the
import's rules, the UI's rules in short, and one line for each moved section with its link. The pull request lists
every moved rule and where it now is.

## 5. Measuring the check

**To do.** On a clean clone of main, record:

- `bun run check` cold (turbo's cache empty) and warm (nothing changed);
- after a change to one file in `packages/catalog/model`, and to one in `apps/inventory/src/web`;
- what the output says when one law fails, when two fail, and when the type-check fails: how many lines, and where
  the line to fix appears.

These numbers set the targets of steps 6 and 7. Nothing is changed in this step.

**First reading, 2026-11-26.** On this packet's branch, with only two Markdown files changed, `bun run check` passed
in 4.5 s: 107 tasks, 90 replayed from turbo's cache. A warm check is already fast, so step 7 may matter less than
step 6. What costs time on a small change is reading what a law refused and how to satisfy it. If the cold and
one-file numbers agree, step 7 shrinks to documenting `--affected`, or is dropped with his word.

## 6. One summary

**To do.** Design first:

1. A schema of a finding, `LawFinding`: the law, the file, the line, what was found and what to write instead. The laws
   of `@beep/repo-cli` already print these parts, each in its own words.
2. Each law, on failure, also writes its findings to a file under `.beep/laws/` (git-ignored), decoded through that
   schema.
3. A last task, `bun run beep laws summary`, reads those files and prints one table, and turbo runs it after the
   others even when they fail. The type-check and the tests are named in it as failed tasks with their first error
   line, since they are not laws.

Whether turbo can run a task after a failed one, or `check` needs a small runner script, is found out in the
scratchpad first.

## 7. `check:changed`

**To do.** `bun run check:changed`: the file-reading laws on `git diff --name-only $(git merge-base HEAD origin/main)`,
then `turbo run check lint test --affected` for the type-check and the fast tests of the packages those files touch.
The target time comes from step 5. It is documented as the check before a commit, with `bun run check` still before
every push. Whether `CLAUDE.md`'s "Run `bun run check` before every commit" becomes "`check:changed` before a commit,
`check` before a push" is his; until he says so, the rule stays.

## 8. A merge that finishes on its own

**Found.** Merging pull requests 23 and 24 meant an agent waited on both required checks, then merged with
`--match-head-commit`. The rule on main requires the two checks and no approval, so auto-merge would protect exactly
as much.

**To do.** Benjamin turns on "Allow auto-merge" (and, if he wants, "Automatically delete head branches") in the
repository's settings. It is his setting, so no agent changes it. Then "merge it" means
`gh pr merge <n> --merge --auto --match-head-commit <sha>`, and `CLAUDE.md` says so.

## 9. Worktrees and the main checkout

**Found on 2026-11-26.** 55 worktrees: 38 under `.claude/worktrees/`, 15 under the session cache of an earlier atoms
session, and one each in two sibling folders (`interview/inventory-import-latest`, `sean-demo/rebuild`). 13 are on a
branch, 8 of those branches are in main, and 42 are detached. The main checkout is on `docs/alchemy-uptake-goal` with
nine changed files and four untracked paths when last looked at, among them `goals/alchemy-domain-uptake/`,
`.claude/agents/domain.md` and `apps/inventory/test/stack/`. The count moved while this packet was written, so another
session is likely working there.

The agent said the repository's worktrees broke the global rule, which puts them under
`~/YeeBois/workstation-apps/worktrees/`. That was wrong: the rule covers workstation apps, and this repository is not
one. `.claude/worktrees/` is where the Claude app puts them, and nothing written says so.

**To do.** A table of every worktree: path, branch or detached, in main or not, clean or not, last commit date. On his
yes, remove the clean ones whose branch is in main and the clean detached ones whose commit is in main, then
`git worktree prune`. He says whose the main checkout's changes are. `CLAUDE.md`, "How we work", gets one line on where
worktrees go.

## Decided 2026-11-26

All seven questions were answered by dialog, each as recommended, and are written in
[the exploration's decisions](../../explorations/ideal-architecture/DECISIONS.md), "2026-11-26 — focus and friction".
In short:

- **Step 2.** New ontology slices, new laws and new vendored libraries wait until step 3 is recorded. Fixes, and
  steps 4 to 9, go on. Step 2 is done.
- **Step 3.** One operations person with a spreadsheet they really use, on `bun run dev` on Benjamin's machine, him
  beside them.
- **Step 4.** This goal owns it, at 200 lines or fewer; quality's step 3 is moved here. The laws go to
  `docs/laws.md`.
- **Step 7.** Once `check:changed` is built and measured faster, a commit needs it and a push needs `bun run check`.
- **Step 8.** Benjamin turns on auto-merge and automatic deletion of head branches.
- **Step 9.** An agent removes clean worktrees whose commit is in main. Dirty or unmerged ones, and the main checkout,
  are listed for him.
