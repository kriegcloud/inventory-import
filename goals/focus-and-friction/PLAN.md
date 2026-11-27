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
| 5 | Measure `bun run check`: how long, and what a failure prints | the record below | done: 2026-11-26 |
| 6 | One summary at the end of a failing check | 35 | done: 2026-11-26 |
| 7 | `bun run check:changed` | 40 | done: 2026-11-26 |
| 8 | A merge that finishes on its own | none, or one for the rule in `CLAUDE.md` | todo |
| 9 | The worktrees and the main checkout | one for `CLAUDE.md` | doing |
| 10 | Close: the closing note, `status: done`, `bun run check:full` on main | one | todo |

Every question was answered on 2026-11-26 ("Decided", below). Step 5 is done. Steps 4, 6, 7 and 9 can start. Step 8 waits on Benjamin's change to the settings, and step 3 on a person he brings.

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

**Measured, 2026-11-26**, on main at `e792c8aa`, by a workflow whose numbers a separate agent re-read from the raw
logs. The machine has 64 cores and was shared: its load average was 8 to 40 during the runs. Turbo's cache is local
only (`TURBO_CACHE_DIR` under the home folder, about 24 GB). No remote cache is set up. Ten of the 107 tasks are
never cached and run every time.

| Run | Wall time | Replayed from cache | What set the time |
| --- | --- | --- | --- |
| Cold (`bun run check --force`) | 218 s | 0 of 107 | `catalog-web` tests 206 s; `prove` 186 s, in parallel |
| Warm, nothing changed | 3.5 s | 97 of 107 | the ten uncached tasks |
| One comment line in `packages/catalog/model/src/Item/Items.handler.ts` | 167 s | 77 of 107 | `catalog-web` tests, 163 s; `prove` replayed |
| One comment line in `apps/inventory/src/web/Workspace.tsx` | 10 s | 85 of 107 | the app's check, lint and test |
| `turbo run check lint test --affected --force`, the same web change, base `origin/main` | 8.6 s | 0 of 4 | the app's three tasks; no root law ran |

What a failure prints, in a scratch worktree with the change below and `bun run check`:

| Case | Lines printed | Tasks turbo reports failed | Where the line that says what to fix is | Does the end say what to fix? |
| --- | --- | --- | --- | --- |
| `??` in `packages/catalog/model/src/Words.rules.ts` | 769 | `defaults:check` | line 706, 63 lines from the end; names file, count and what to write | No: only the task's name |
| `??` and `xs[0]!` in the same file | 192 | `assertions:check` only | line 112, 80 lines from the end; names file and line, not what to write | No |
| A string assigned to a `number` there | 791 | `catalog-model#check` | line 764, 28 lines from the end; names file and line | No |

Three things this changes:

1. **A failing check stops at the first failure, so a second broken law is never reported.** In the two-law case
   turbo stopped when `assertions:check` failed and killed `defaults:check` before it printed. That law's message
   appeared only when it was run alone. A person fixes one law, runs the check again, and meets the next. Turbo also
   prints "exited with code 130" for each task it stopped (seven of them in the type-error case), and those read like
   failures. Step 6 starts from this: `check` runs with `--continue`, so every task finishes, and the summary lists
   every failure, not just the first.
2. **A small change can cost three minutes.** The first reading, 4.5 s on a Markdown change, was misleading. Touching
   one model file re-runs `catalog-web`'s tests, 163 s of the 167. `--affected` would not save that, since
   `catalog-web` depends on the model. Step 7 is therefore about which tests a commit needs, not about turbo's
   scope. Is it the changed package's own tests, with its dependents' tests left for the push? That decision is
   Benjamin's: the push check would still run all of them.
3. **`--affected` needs its base set.** With no `TURBO_SCM_BASE`, turbo compares against the local branch `main`.
   In this worktree that branch was 94 commits behind `origin/main`, so every package counted as affected. With
   `TURBO_SCM_BASE=origin/main`, the web change affected only `@inventory/app`, and no root law ran. So
   `check:changed` sets the base to the merge base with `origin/main` and runs the file-reading laws itself.

Not measured: each check and lint task's own time (turbo does not print it, and `--summarize` was not used). The
type-error case's diff was not saved, so only its log shows the change.

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


**Built, 2026-11-26. The design changed.** No law writes a findings file. The summary reads what turbo already
records: its run summary (`--summarize`, `.turbo/runs/<id>.json`) names every failed task, and the run's own log
(`--log-file`, kept beside it as `<id>.log`) holds what each task printed. So no law changed, and the type-check,
oxlint, the formatter and the tests are summarised the same way as the laws.

- `check`, `check:full` and `check:ci` are now `bun packages/tooling/tool/cli/src/bin.ts check run -- turbo run
  <the same tasks>`. The runner streams turbo's output unchanged, adds `--continue` and `--summarize` when they are
  not already there (CI passes both), and returns turbo's exit code. On a failure it prints the summary last. On
  success it prints nothing more. Whatever a caller appends still reaches turbo (`bun run check -- --filter=...`,
  `--force`). It keeps the ten newest run records.
- `bun run beep check summary` prints the summary of the newest run by hand.
- For each failed task the summary gives up to ten lines that say what to fix, whole, with the file and line where
  the log names them, then the log that holds the rest. A log with no such line gives its last eight lines.
- A task turbo never caches (every root law, the format check) keeps a log file from an earlier run, or none, so the
  summary reads this run's own output first and a task's log file only when that holds nothing.
- `config-sync` writes and checks the three scripts in their new form.

**Checked.** A scratch line with one `??` and one `x!` in `packages/catalog/model/src/Words.rules.ts`, then
`bun run check`: exit 1, 104 of 107 tasks passed, and the output ended with

```
//#assertions:check (exit 1)
  packages/catalog/model/src/Words.rules.ts:16:62: error typescript(no-non-null-assertion): Forbidden non-null assertion.
//#defaults:check (exit 1)
  packages/catalog/model/src/Words.rules.ts  holds 1 fallback, and may hold 0: ... Put the starting value on the schema ...
  packages/catalog/model/src/Words.rules.ts:16  xs[0]! ?? "x"
//#format:check (exit 1)
  packages/catalog/model/src/Words.rules.ts (0ms)
3 of 107 tasks failed
```

Both laws are reported in one run, where step 5 saw only the first. With the line removed, `bun run check` passed
107 of 107 and printed no summary; run again it replayed 96 from the cache in 3.9 s, as before.
`bun run check -- --filter=@beep/repo-cli` ran 32 tasks. The test `test/CheckSummary.test.ts` feeds the summary two
laws' failures and a package's type error.

**Not checked.** `check:full` and `check:ci` were not run whole; they share the runner, and CI runs `check:ci` on
the pull request. The assertions law's line says what is forbidden and not what to write: that is oxlint's text, and
the summary adds nothing to a law's words.

## 7. `check:changed`

**Decided 2026-11-26.** By dialog, as recommended: "Own tests only" — it type-checks and lints the changed packages
and everything that depends on them, runs every root law, and runs tests only in the packages whose files changed;
dependents' tests wait for `bun run check` before the push. `bun run check` is unchanged and still runs everything.

**To do.** Build and measure `bun run check:changed` before a commit. Root laws run whole, rather than per changed
file: they take seconds and most read the whole tree. The merge base with `origin/main` selects changed packages,
including uncommitted and untracked files; type-check and lint include dependents, but tests and proofs belong to
changed packages only. No package changed means root laws only. Shared root configuration runs all packages' own
tests as well. Reuse the full check's runner and failure summary.

**Built.** `check changed` reads the root laws from the root `check` script, and package names, scripts and dependency
edges from workspace manifests. A schema-backed pure planner emits one turbo run, with explicit own `test` and
`prove` tasks and the merge-base filter for type-check and lint. It shares `check run`'s runner, `--continue`,
`--summarize`, failure summary and exit code. Extra arguments after `--` reach turbo. No scope-override option was
added just for timing.

Timed by hand before the build, with the same turbo line the planner writes, beside step 5's full check:

| One comment line in | Full check (step 5) | The changed-only turbo line | Tasks in changed run |
| --- | --- | --- | --- |
| `packages/catalog/model/src/Item/Items.handler.ts` | 167 s | 68 s | 39 |
| `apps/inventory/src/web/Workspace.tsx` | 10 s | 13 s | 32 |

The model change avoids its dependents' long tests. The web change gains nothing: the app has no dependents, and
the root laws run either way. The command itself was not timed on a one-file change: this branch changes the root
`package.json`, which makes every run on it the global case. That timing is taken on main after the merge, and
SPEC's acceptance stays unticked until then.

End to end on this branch: `bun run check:changed`, with the root
`package.json` changed, announced all 28 packages and passed 107 of 107 tasks, zero replayed, in 196.85 s wall time
(turbo: 196.517 s). This is the global-change case, not an isolated one-file timing.

**Probed.** On this checkout with turbo 2.11.13 and merge base `4043181f`, `turbo ls --filter=[B] --output=json`
selected zero packages with no change, 28 after a whitespace edit to `turbo.json`, and zero after whitespace edits
to each of `bun.lock`, root `package.json` and `tsconfig.base.json`. With this build's root script and CLI edits it
selected only `@beep/repo-cli`. So the command also checks changed root paths explicitly: any of those four files
runs every package's own tests and proofs, and says so. Every probe file was restored byte for byte.

**Checked.** The CLI's type-check, lint and 740 fast tests passed, including the planner's leaf, dependent/proof,
no-package and global-change cases and forwarding arguments through Bun. `config-sync:check` and `docs:check`
passed. In a temporary root without `origin/main`, the command exited 1 with the instruction to
`git fetch origin main`.

Appending `export const scratchTwo = (xs: ReadonlyArray<string>) => xs[0]! ?? "x"` to
`packages/catalog/model/src/Words.rules.ts`, then running `check:changed`, exited 1 in 54.42 s. Its final summary
named both `//#assertions:check` and `//#defaults:check`: 2 of 107 tasks failed. The file was then restored byte for
byte from its saved copy. The full `bun run check` then passed 107 of 107 tasks, 92 replayed, in 3.62 s wall time
(turbo: 3.445 s). SPEC's acceptance remains unticked; step 7 stays `doing` until its pull request is merged.

**Timed on main after the merge, 2026-11-26**, at `4db228f2`, each with `bun run check:changed` itself:

| Change | `bun run check` (step 5) | `bun run check:changed` | Tasks |
| --- | --- | --- | --- |
| One comment line in `packages/catalog/model/src/Item/Items.handler.ts` | 167 s | 37 s | 39 |
| One comment line in `apps/inventory/src/web/Workspace.tsx` | 10 s | 10 s | 32 |
| Nothing changed | 3.5 s | 4 s | 29 |

The target SPEC's acceptance names is this table: a one-file change in one package finishes in at most 60 s. The
failing case was run before the merge, on the branch (above). Step 7 is done.

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

**Done, 2026-11-26, 20:55.** 57 worktrees were listed with `git worktree list --porcelain`, and each was read for its
branch, whether its commit is in `origin/main`, `git status --porcelain` and its last commit's date. None of them had a
process running inside it. Seven were clean with their commit in main, and were removed with `git worktree remove`,
then `git worktree prune`:

| Removed | Branch | Commit |
| --- | --- | --- |
| `.claude/worktrees/alchemy-uptake-setup` | `docs/alchemy-uptake-goal` (#30, merged) | `a4c37ae9` |
| `.claude/worktrees/integration-b24a` | `integration/b48` | `c66937b5` |
| `.claude/worktrees/kernel-drivers-c595b2` | detached | `3a3ff59b` |
| `.claude/worktrees/party-slice` | `goal/party-slice` (#23, merged) | `e8b5aafb` |
| `.claude/worktrees/patches` | `claude/patches` | `5e99a950` |
| `.claude/worktrees/strict-hosts-5e2ab1` | detached | `c21d5482` |
| the atoms session's cache, `scratchpad/loop` | detached | `c0391da7` |

The four local branches among them were deleted with `git branch -d`, which refuses a branch that is not merged. Their
copies on GitHub were left, since deleting those is the setting of step 8. What git ignores in them went with them:
`.mutants/` folders, `.scratch/` screenshots and one `.scratch-dev.log`.

The 51 left, this step's own included, each with why it stays:

| Worktree | Branch | In main | Changed files | Last commit | Why it stays |
| --- | --- | --- | --- | --- | --- |
| the main checkout | `feat/domain-uptake-move-1` | no | 63 | 2026-11-26 | Pull request 32, open; a session is working there. Whose the changes are is Benjamin's |
| `.claude/worktrees/focus-and-friction` | `goal/ff-summary` | no | 0 | 2026-11-26 | Step 6, pull request 35, open |
| `.claude/worktrees/ff-worktrees` | `goal/ff-worktrees` | no | 2 | 2026-11-26 | This step's pull request |
| `.claude/worktrees/ci-speed` | `fix/ci-cache-run-counts` | yes | 1 | 2026-11-26 | One changed file |
| `.claude/worktrees/integration` | `integration/b10` | yes | 0 | 2026-11-22 | Clean and in main, but git ignores an `.alchemy/` state folder and `packages/infra/env/op.env.local` in it. Benjamin's |
| `sean-demo/rebuild` (a sibling folder) | detached | yes | 0 | 2026-11-22 | Clean and in main, but in another project's folder. Benjamin's |
| `interview/inventory-import-latest` (a sibling folder) | `chore/actions-node24` | no | 0 | 2026-11-26 | Branch not in main |
| `.claude/worktrees/integration-b11` | `integration/b43` | no | 0 | 2026-11-23 | Branch not in main |
| `.claude/worktrees/wf_9da7e007-88f-3` | `worktree-wf_9da7e007-88f-3` | no | 0 | 2026-11-23 | Branch not in main |
| `.claude/worktrees/atoms-b569e5` | detached | no | 0 | 2026-11-25 | Commit not in main |
| `.claude/worktrees/defaults-last` | detached | no | 0 | 2026-11-26 | Commit not in main |
| `.claude/worktrees/wf_083b9049-27a-1`, `wf_0a2b9bdf-fd3-1` | detached | no | 2 each | 2026-11-22 | Changed, commit not in main |
| `.claude/worktrees/wf_29cd7dc9-997-1` | detached | no | 11 | 2026-11-22 | Changed, commit not in main |
| `.claude/worktrees/wf_31a2095e-a44-1`, `-2` | their own `worktree-wf_…` branches | yes | 2 and 1 | 2026-11-22 | Changed |
| 21 other `.claude/worktrees/wf_*` of workflows from 2026-11-21 and 22 | detached | yes | 1 to 57 | 2026-11-21 to 22 | Changed |
| 14 under the atoms session's cache: `scratchpad/chk-world` and its 13 mutant copies in `.mut/` | detached | no | 22 to 25 | 2026-11-22 | Changed, commit not in main |

The `wf_*` worktrees are what Workflow runs left behind: a child agent's worktree is kept when it has changes. Most
of those changes may be work that a merged pull request already holds in another form, but that was not checked file
by file, so they stay until Benjamin says.

`CLAUDE.md`, "How we work", now says where this repository's worktrees go and when one is removed.

**Compared, 2026-11-26, on Benjamin's answer** (the exploration's decisions, "the commit check's tests, and the
worktrees left"). Each of the 26 changed `wf_*` worktrees was compared with `origin/main` at `4043181f`, file by
file: a changed or new file counts as held when its content hashes the same as main's file at that path, a deleted
file when main no longer has it either. A worktree would be removed only if every file were held. None was, so none
was removed. Most were cut before main's packages moved (the catalog's web package, the review region), so a
difference may only mean the file now lives elsewhere, not that it holds work main lacks. That was not checked.

| Worktree | Changed files | Different from main | First of them |
| --- | --- | --- | --- |
| `wf_083b9049-27a-1` | 2 | 2 | `packages/review/src/internal/ReviewGrid.tsx`, `packages/review/src/internal/ReviewQueue.tsx` |
| `wf_0a2b9bdf-fd3-1` | 2 | 2 | `packages/catalog/web/test/Draft.machine.test.ts`, `packages/catalog/web/test/support/draftWorld.ts` |
| `wf_1d27d04d-290-1` | 23 | 21 | `apps/inventory/test/server/ConfirmRevision.slow.test.ts`, `apps/inventory/test/server/Imports.slow.test.ts`, `apps/inventory/test/server/MatchAtomic.slow.test.ts`, … |
| `wf_1d27d04d-290-2` | 23 | 20 | `packages/catalog/web/src/Draft.atoms.ts`, `packages/catalog/web/src/Draft.machine.ts`, `packages/catalog/web/src/Notices.atoms.ts`, … |
| `wf_1d27d04d-290-3` | 39 | 36 | `apps/inventory/src/web/App.tsx`, `apps/inventory/src/web/Workspace.tsx`, `apps/inventory/src/web/components/app/AppSidebar.tsx`, … |
| `wf_29973122-576-1` | 3 | 3 | `DECISIONS.md`, `packages/catalog/web/src/Draft.machine.ts`, `packages/catalog/web/test/Draft.machine.test.ts` |
| `wf_29973122-576-2` | 57 | 31 | `apps/inventory/test/web/gridCallbacks.test.ts`, `docs/kit.md`, `docs/standards/engineering.md`, … |
| `wf_29cd7dc9-997-1` | 11 | 11 | `DECISIONS.md`, `docs/review-table.md`, `packages/review/src/ReviewDraft.rules.ts`, … |
| `wf_29cece89-99a-1` | 1 | 1 | `packages/catalog/web/test/zz_probe.test.ts` |
| `wf_29cece89-99a-2` | 50 | 32 | `docs/kit.md`, `docs/standards/engineering.md`, `docs/standards/no-try.md`, … |
| `wf_2d6f9c1b-d53-1` | 16 | 15 | `apps/inventory/test/server/MatchAtomic.slow.test.ts`, `apps/inventory/test/server/Rematch.slow.test.ts`, `apps/inventory/test/server/WaitedRows.slow.test.ts`, … |
| `wf_31a2095e-a44-1` | 2 | 2 | `packages/catalog/web/src/Draft.machine.ts`, `packages/catalog/web/test/Draft.machine.test.ts` |
| `wf_31a2095e-a44-2` | 1 | 1 | `packages/catalog/web/test/SessionAsked.test.ts` |
| `wf_6903598d-ac8-1` | 4 | 3 | `apps/inventory/test/server/Tenancy.slow.test.ts`, `packages/catalog/host/src/ImportStore.adapter.ts`, `apps/inventory/test/server/WriteLimits.slow.test.ts` |
| `wf_6903598d-ac8-2` | 1 | 1 | `packages/catalog/web/src/Draft.machine.ts` |
| `wf_6ea7687d-dc3-1` | 12 | 10 | `goals/atoms/PLAN.md`, `packages/catalog/model/src/Item/ItemSearch.rules.ts`, `packages/catalog/model/src/Review/CellReading.rules.ts`, … |
| `wf_721d0736-442-1` | 13 | 12 | `apps/inventory/test/server/MatchAtomic.slow.test.ts`, `apps/inventory/test/server/Rematch.slow.test.ts`, `apps/inventory/test/server/WaitedRows.slow.test.ts`, … |
| `wf_721d0736-442-2` | 23 | 20 | `DECISIONS.md`, `apps/inventory/src/web/Workspace.tsx`, `apps/inventory/src/web/lib/ofThisPage.ts`, … |
| `wf_85855b04-75e-1` | 21 | 6 | `docs/kit.md`, `goals/atoms/PLAN.md`, `packages/catalog/web/test/ItemsTableAddress.test.ts`, … |
| `wf_df3fabe5-99a-1` | 27 | 24 | `DECISIONS.md`, `packages/catalog/web/src/Draft.atoms.ts`, `packages/catalog/web/src/Draft.machine.ts`, … |
| `wf_e0d42d40-674-1` | 14 | 13 | `apps/inventory/test/server/MatchAtomic.slow.test.ts`, `apps/inventory/test/server/Rematch.slow.test.ts`, `apps/inventory/test/server/StaleAccepts.slow.test.ts`, … |
| `wf_e0d42d40-674-2` | 22 | 21 | `apps/inventory/src/web/Workspace.tsx`, `packages/catalog/web/package.json`, `packages/catalog/web/src/Draft.atoms.ts`, … |
| `wf_e2345590-b7b-1` | 12 | 10 | `docs/standards/engineering.md`, `docs/standards/no-try.md`, `package.json`, … |
| `wf_e2345590-b7b-2` | 38 | 23 | `apps/inventory/scripts/grid-keys.mjs`, `docs/kit.md`, `packages/access/web/src/Session.atoms.ts`, … |
| `wf_e4a7914b-cfd-1` | 20 | 20 | `apps/inventory/test/web/gridAtoms.test.ts`, `docs/kit.md`, `goals/atoms/PLAN.md`, … |
| `wf_f2fe47fa-07d-1` | 10 | 8 | `goals/atoms/PLAN.md`, `packages/catalog/model/src/Item/ItemSearch.rules.ts`, `packages/catalog/model/src/Review/CellReading.rules.ts`, … |

`integration` and `sean-demo/rebuild` stay, on the same answer.

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

**Answered in step 7.** Own tests only, decided by dialog on 2026-11-26 as recommended; dependents' tests wait for
the full check before the push.
