---
name: quality-review-fix-loop
description: >
  Close a piece of work with a quality loop: green baseline commit, a panel of read-only reviewers, fixes routed to
  fixer agents by file ownership, waivers for what stays, zero required blockers. Use when Benjamin asks to run the
  quality loop, to close out the build before the write-up, or to loop reviewers and fixers until nothing required
  remains.
metadata:
  version: "0.1.0"
  origin: ported from one of Benjamin's own repositories; the defaults are this repo's
---

# Quality review fix loop

Use near the end of a piece of work. The goal is not endless polishing. It is a green, committed, review-ready
state with zero required blockers in the chosen scope.

## Header

Fill or infer before starting:

- `repo_root`: `git rev-parse --show-toplevel`
- `summary`: one paragraph on what was built
- `base_ref`: the brief commit, the one `bun run clock` counts from (the first that adds a file under `brief/` other
  than its README):
  `git log --reverse --no-renames --diff-filter=A --format=%h -- brief ':(exclude)brief/README.md' | head -n 1`
- `review_scope`: files changed since `base_ref`, plus the screens, endpoints and tables they touch
- `zero_gate`: zero required blocker findings from the reviewer panel
- `loop_budget`: one round inside the hour; a second only if the first finished before minute 40
- `commit_policy`: green baseline commit before the loop; a commit per fix group; never push
- `waiver_policy`: a required blocker may remain only with a waiver record (see `references/templates.md`), and
  each waiver is also a line under "Known wrong or missing" in `DECISIONS.md`

## This repo's defaults

Sources of truth. Read what is relevant to the changed files before reviewing; never review from generic taste:

- `brief/` (it decides what was asked for)
- `CLAUDE.md`: "Rules for an import", "Identity and permissions", "What the type-check enforces", "Platform", "UI"
- `docs/patterns.md` (section 8 for screens), `docs/kit.md`, `docs/review-table.md` where they apply
- `DECISIONS.md` for what Benjamin chose and cut: a cut he made is not a finding

Quality commands, from `repo_root`:

```bash
bun run format -- <the files changed since base_ref>   # never a bare format: it rewrites every lane's files
bun run check:full
bun run build
```

and, for anything with a screen, `bun run lighthouse -- <path>` and the inspector (role 5). Warnings count: do not
call the baseline green while a relevant one remains.

## Operating rules

- Run `bun run clock` first. Say the minute and whether the budget allows a round.
- Inspect the working tree first; never revert changes you did not make.
- Keep scope to this hour's work. The template commit is not under review.
- Reviewers are read-only: they inspect, run the app and commands, and report. They do not edit.
- Fixer agents edit only the files they are given and are told other agents share the repo. Two fixers never share
  a file. A one-file fix is done in the main thread: a fixer agent costs more than it saves there.
- Evidence over opinion: a blocker needs concrete evidence and a concrete way to clear it. Improvements that do not
  protect the person importing, correctness or an honest write-up go to the backlog.
- A finding that needs a product decision is not a fixer's job: bring it to Benjamin with a recommendation.

## Phases

**Phase 0: grounding.** Confirm `repo_root`, the working tree and `base_ref`. Capture what changed
(`git status --short`, `git diff --name-status {{base_ref}}...HEAD`, `--stat`). Summarise the work in three to six
bullets: what the person can do, what was touched, what is risky, what is known to be unfinished.

**Phase 1: baseline and commit.** Run the quality commands, fix every relevant failure or warning, rerun until
green, then commit. Record the commit and the commands run. Do not start reviewers before a green committed
baseline.

**Phase 2: read-only reviewer panel.** Launch the seven roles in `references/reviewer-roles.md` in parallel, each
with the summary, `base_ref`, the changed files, the sources of truth and the item format from
`references/templates.md`. Give the reviewers that use the app the dev server's address and say which organization
each may write in, so two reviewers never trip over each other's data.

**Phase 3: triage and routing.** Merge the reports into one inventory: drop duplicates; reject findings with no
evidence or no fix; move anything outside this hour's work to the backlog; group blocking findings by the files they
touch; give each group to one fixer with the prompt in `references/templates.md`. Start the fixers on the groups
that block the person, then put the rest to Benjamin in a decision round (`CLAUDE.md` "Decisions by dialog"), most
harmful first: he may cut a group, and anything that is a product decision is his.

**Phase 4: verification.** Read each fix, run its acceptance command, rerun the baseline, commit. If the budget
allows, relaunch only the reviewers whose findings were fixed. Stop when there are zero required blockers, or every
remaining one has a waiver, or the budget is spent. Then report what remains, why, and what you recommend.

## References

- `references/reviewer-roles.md`: the seven roles and the reviewer contract
- `references/templates.md`: the inventory item format, severity calibration, the fixer prompt, waiver and backlog
  records, the final report format

Do not say the work is ready while a required blocker has no waiver or the baseline is red.
