---
type: Plan
title: "Quality, plan"
description: The seven steps of the quality goal in the order to take them, what was found for each on 2026-11-25 and how, the check that closes each, and the questions that are Benjamin's.
from: explorations/alchemy-domain
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance. Status is one of `todo`, `doing`, `done`. The order is cheapest
first, so that the long steps start from a repository whose check passes everywhere. Each step is a branch and a pull
request of its own.

| # | Step | Size | Status |
| --- | --- | --- | --- |
| 0 | Where main stands: `bun run check:full` on `main` | minutes | todo |
| 1 | The laws that read oxlint's report pass in a JetBrains terminal | an hour | todo |
| 2 | Loose ends: the push rule, `docs:check`'s warnings, the explorations' README | an hour | todo |
| 3 | `CLAUDE.md` under 400 lines; the two agent files name folders that exist | half a day | todo |
| 4 | The prover reads a case's own `status` (a fourth patch) | a day or two | todo |
| 5 | The transitions say their claim, if the prover reads a helper | a day, after an experiment | todo |
| 6 | The five longest files split | several days, one file a pull request | todo |
| 7 | The review a person uses runs on the model | the exploration's moves 2 on: weeks | todo |

**Current blocker:** none. Step 0 is first.

## What was done before this plan

Pull request 10, merged into `main` as `23d1a457` on 2026-11-25: the model's eight invariants over every import, row
and group say their claim through five helpers in `packages/catalog/model/src/Catalog.model.ts`, and the 0 that says
"not taken back" is read in one place, `inForce`. Verify passed on a lock written again on purpose; the old and the
new invariants answered alike on 300,000 random models, but for one case made stricter on purpose. Not run for it: the
fold, the mutants' sample, the slow tests. Step 0 runs them.

## The steps

### 0. Where main stands

`bun run check:full` on `main`, from a terminal that is not JetBrains' (or with `env -u TERMINAL_EMULATOR`). It runs
what pull request 10 did not: the fold, the mutants' sample, the slow tests and the build. A failure there is fixed
before anything else, with `/diagnosing-bugs` if it survives one fix.

### 1. The laws pass in a JetBrains terminal

**Found.** With `TERMINAL_EMULATOR` set (WebStorm's terminal sets `JetBrains-JediTerm`), oxlint writes each finding's
`filename` as `file:///<the whole path>` in its JSON report; without it, as a path from the root. Found by taking one
variable at a time out of the environment and running
`node_modules/.bin/oxlint -c .oxlintrc.fast-refresh.json -f json apps/inventory/src/web/Root.tsx`: only that variable
changes the answer (oxlint 1.93.0).

`fast-refresh:check` then matches no finding against its ledger and says of every listed file that it "breaks the
rule no more: take its line off", so `bun run check` fails with nothing wrong.

**Not checked.** Two more laws read the same field: `Promises.rules.ts` (line 317) and `DeprecatedApis.rules.ts`
(line 284). `Quality/Strict.rules.ts` and `Infra/InfraSetup.rules.ts` ask for JSON too. Whether each fails the same
way was not seen: the run that would have shown it was stopped by the first failure.

**Do.** One reader of oxlint's report for every law, which gives a path from the root whatever the report holds, in
the CLI's own code; the schema that decodes the report does it (a transformation, SF-5), not each law. Do not answer
it by taking the variable out of the child's environment alone: another terminal may do the same under another name.
A test for each law feeds it a report whose file is a `file://` address.

**Done when** the first acceptance line holds.

### 2. Loose ends

- **The push rule.** Done 2026-11-25, at his word: `.claude/settings.json` moved `Bash(git push:*)` from `deny` to
  `ask`, in a commit of its own on this goal's first pull request. A push from an agent now asks him each time.
  `CLAUDE.md` says "never push unless Benjamin asks in that message": it stays.
- **`docs:check` warns** 14 times, once for every goal and exploration: "unknown status value 'done' (expected:
  draft|stable|deprecated)", and the same for `active` and `graduated`. The validator knows the format's three
  statuses; `goals/README.md` and the explorations' README give their own (`active`, `done`, `dropped`, `graduated`).
  The check passes all the same, so the warnings are noise that hides a real one. Teach the check the two folders'
  statuses, from the two READMEs, so that a status neither names is refused and these are not warned about.
- **The explorations.** `explorations/` is 53,000 lines, 66 of its 81 files in `alchemy-domain`. `erp-ontology` says
  `graduated`; the other two say `active`. Nothing is deleted without his word (below, "His to decide").

### 3. `CLAUDE.md` and the agent files

**Found.** `CLAUDE.md` is 775 lines. The row for `bun run check` in "Commands" is one cell of several hundred words;
"What fails the check" and "The model's blocks" are reference, read when a check fails and not before.
`.claude/agents/backend.md` and `frontend.md` describe a layout that is gone: `src/domain`, `src/domain/Item.ts`,
`src/server/Items.ts`, `src/web/pages/ItemsPage.tsx`, `useUpload` in `src/web/lib/upload`. The contexts under
`packages/` replaced all of it (`CLAUDE.md`, "Layout").

**Do.** Move, do not rewrite: the checks `bun run check` runs become a list in `docs/standards/` (one line a check:
its name, what it refuses, how to repair), and `CLAUDE.md` keeps one sentence and the link. The same for "What fails
the check", "Also enforced" and "The model's blocks", which already has `docs/verify.md` to live beside. Each new page
is listed in its folder's `index.md` with OKF frontmatter. Then the two agent files: every path checked with `ls`
before it is written, the recipe taken from `CLAUDE.md`, "Adding a feature".

**The one thing not to break:** a rule that moves keeps its words. Hold the old file and the new pages side by side
before the commit: every sentence of the old is in one of them.

**Done when** the fifth acceptance line holds, and a fresh agent given "add a field to an item" names the right
packages from the agent file alone.

### 4. The prover reads a case's own `status`

**Found.** On 2026-11-25 Benjamin took `status: "Open"` and its kin out of the `make` calls in `Import.aggregate.ts`
and `Group.aggregate.ts`: the constructor gives them. `bun run --cwd packages/catalog/model prove` then failed:
`StageImport`, `ConfirmImport`, `TakeBackImport`, `ReopenImport` and `RemoveImport` came back "read wrongly" with
"The state stays in its schema" failing beside them, and `AGroupIsRecorded` and "Every state stays in its schema"
came back "not proved". The prover runs no `make`: it reads the fields written in the call, so a state built without
its status has no case. The edit was rolled back. The rule "with the status written out" exists only for this.

**Do.** A fourth patch, `packages/patches/alchemy-domain/04-<name>.patch`, beside the third, which taught the prover
`.make`, `guards`, `isAnyOf` and `match`: a `make` of a case of a `S.toTaggedUnion` union is read with the tag that
case's `S.tag` gives. Start in the scratchpad (`bun run scratch:new <name> --template verify`) with a small aggregate
that fails as above. Then the header, the test that fails without the patch and the mutant, as `docs/patches.md`
says; then the statuses come out of every `make` in the model, the proofs pass with the path counts their tests
state, and the rule leaves `CLAUDE.md`, the two aggregates' headers and `docs/verify.md`.

**Risk.** If the tag is not on the case's AST where the interpreter builds the value, the patch is larger than the
third. An hour in the scratchpad says which; if it is, stop and ask.

### 5. The transitions say their claim

**Found.** `Group` has nine transitions; seven open with `!GroupState.guards.Decided(before) || !GroupState.guards.Decided(after) ||`.
In the model's invariants that preamble went into a helper, which was free there: an invariant of the model is
searched, so Verify runs it and does not read its code. A transition is proved: the prover reads it.

**Do.** An experiment first: does the prover read a call to a function of the same file in a transition, and in a
rule of a decision? One aggregate in the scratchpad, one transition written both ways, `prove`. If it reads it:
`Group`, then `Row`, then `Import`, one commit each, the lock written again on purpose, the path counts in the proof
tests as they were or stated anew with the reason. If it does not: `bun run scratch:drop` with the line learned, and
this step is done as "no".

### 6. The five longest files

| File | Lines | First cut to try |
| --- | --- | --- |
| `packages/catalog/model/src/Review/Review.rules.ts` | 1,575 | By what it decides: reading a row, duplicates, outcomes, totals. First, because the preview and the confirm both run it |
| `packages/catalog/host/src/ImportStore.adapter.ts` | 1,722 | By write: staging, decisions, the confirm, the take-back |
| `packages/catalog/model/src/Catalog.memory.ts` | 1,828 | One in-memory twin a port, as the ports are |
| `packages/catalog/web/src/Draft.machine.ts` | 2,152 | Its states and its transitions apart from what it sends |
| `packages/review/src/internal/ReviewGrid.tsx` | 1,984 | The grid, its cells and its keyboard apart |

The cuts are guesses from the names: none of the five was read through. Read the file before choosing its cut, and
say the cut before making it.

**Six more are past the line**, counted on 2026-11-25 with the acceptance command, and come after the five, longest
first: `packages/tooling/tool/cli/src/commands/Infra/InfraSetup.rules.ts` (1,900: longer than three of the five, and
left for later because it is the CLI's and nothing a person sees runs it), `packages/review/src/ReviewDraft.rules.ts`
(1,314), `packages/tooling/tool/cli/src/commands/Scratch/Scratch.rules.ts` (1,165),
`packages/review/src/ReviewRegion.types.ts` (1,115), `packages/tooling/tool/cli/src/commands/Release/Release.rules.ts`
(1,079) and `packages/review/src/ReviewRegion.component.tsx` (1,017). `packages/catalog/web/test/support/draftWorld.ts`
(1,590) is under `test/` and is no test file: whether it counts is part of the question below.

**Rules for each.** One file a pull request. No behaviour changes: a function moves with its JSDoc and its tests keep
passing untouched, which is the proof. The old path keeps exporting what other packages import, or every importer
moves in the same commit. A file a model's task reads goes into `packages/catalog/model/turbo.json`. A file of screens
exports components only (`fast-refresh:check`); a file's count in a ledger or a baseline moves with its lines and the
sum does not rise. After each: `check:full`, and for the last three the browser pass on a fresh database.

### 7. The review a person uses runs on the model

**Found.** `docs/verify.md`: "Nothing a person sees uses the model yet, and nothing is stored through it." The 134
proved rules are rules of code the app does not run; the fold's property is the only thing that holds the two
together, and they differ on purpose in at least two cases (a row decided over a group stays whole; a row's undo
under a later group is refused).

**Do.** Nothing is designed here. The exploration has it: [BRIEF.md](../../explorations/alchemy-domain/BRIEF.md),
"Order of moves". Move 1, the model in memory, is built and on `main`. This step is: graduate the exploration into
its own goal (`goals/README.md` and the explorations' README say how), with moves 2 on as its plan, and close this
step when that goal is `done`. The brief's order starts "after he signs and the atoms goal is merged": both are his to
confirm before move 2 opens.

## His to decide

Each is asked through `AskUserQuestion` when its step opens, and its answer written here.

| Step | Question | What I would recommend, and why |
| --- | --- | --- |
| 2 | An exploration that ended: does it stay as it is, or go? | Stay, with its README's `status` right. Git history is the archive, and the research is what the decisions cite |
| 3 | May the long tables leave `CLAUDE.md` for `docs/standards/`? | Yes. It is his standing file, so no line moves before he says so |
| 4 | If the patch is larger than the third, is it still wanted? | Ask then, with the hour's finding |
| 6 | Is 1,000 lines the line, and does a test file count? | 1,000, tests not counted: a story file is long because the stories are many |
| 7 | Is the brief signed, and is the atoms goal closed? | His alone |

## Choices made along the way

None yet.
