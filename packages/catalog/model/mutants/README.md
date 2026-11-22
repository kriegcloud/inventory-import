# Mutants of the review's model

What the proofs and the stories of the review are worth is measured by breaking the model on purpose and seeing
whether anything notices. A **mutant** is one change to the model's source, made in a copy of the package:

- **check**: one check of a `decide` removed (`if (!isOpen(s)) return yield* new NotOpen({})` goes), 60 of them;
- **field**: one field of an event given a wrong value (`by: actor.memberId` becomes `by: actor.organizationId`), 77;
- **nothing**: an accepted act made to record nothing (`return []` before the events), 11.

They cover the import's seven commands (`src/Import/Import.aggregate.ts`) and the four decisions
(`src/Review/{Deciding,Undoing,DecidingGroup,UndoingGroup}.decision.ts`). Each runs against its proof
(`test/Import.prove.test.ts` or the decision's `test/*.prove.test.ts`) and both story files
(`test/Review.story.test.ts`, `test/Group.story.test.ts`). The result is one of three classes:

| Class | What failed | What it means |
| --- | --- | --- |
| `rule` | the proof | a proved rule, or one of the report's own counts (its paths, "some state lets it record"), notices the change for every state and input |
| `story` | only a story | an example shows the change is wrong, but no rule says so: the next change of the same kind may pass both |
| `neither` | nothing | the change goes unnoticed: a gap, to be closed by a rule or a story |

An earlier trial of this model ran the same 148 changes and found 111 held by a rule, 37 by a story only and 0 by
neither. Each mutant in `mutants.json` keeps what that trial found (`expect`, and the rules it saw break in
`trialRules`), so a run can say when a rule got weaker.

## Where they run

The sample is the turbo task `mutants:sample` (`bun run --cwd packages/catalog/model mutants:sample`), part of
`bun run check:full` and of CI's proofs job, replayed until what the mutants read changes. All of them are the task
`mutants`, which the nightly workflow runs in a job of its own (`.github/workflows/proofs-nightly.yml`, four at a time).
Neither is in `bun run check` or in CI's main job.

## Commands

From `packages/catalog/model` (the runner finds its paths from its own place, so any folder works):

```sh
python3 -I mutants/run.py --sample              # nine fast mutants, about 25 s
python3 -I mutants/run.py --all --jobs 4        # all 148
python3 -I mutants/run.py --only confirm-sum,group-madeon
python3 -I mutants/run.py --list                # every mutant, and nothing run
```

Flags: `--jobs N` (mutants at once, default 2), `--keep` (keep each copy in `.mutants/<key>/`, with its
`result.json` and `vitest.log`), `--no-baseline`, `--nice N` (default 10), `--timeout S` (seconds before a run is
stopped, default 3600). It needs `bun install` to have run (it uses the repository's `node_modules/.bin/vitest`) and
`node` on the path, and nothing else: Python 3, standard library only.

What a run does: every chosen mutant is first checked to apply to the package's text; then, for each proof file the
chosen mutants use, the unchanged copy is run once (`baseline`; when it fails the run stops with exit 2, since every
mutant would look held). Then each mutant: the package's `src/`, `test/`, `package.json`, `tsconfig*.json` and
`vitest.config.ts` copied to `.mutants/<key>/` (the two configs' `../../../` made two levels deeper), the change made,
and vitest run in the copy on the proof and the two story files with its JSON reporter. One line a mutant (key,
class, seconds, how it compares with the trial, what failed), then the counts by target and the times. Everything
goes to `.mutants/results.tsv` (git-ignored). The package's own files are never written.

It exits 1 when a mutant is held by `neither`, when one the trial found held by a rule is now held by a story only
(`weaker`), when a mutant does not apply, or when a run gave no result; each is printed with its change and what ran.
A mutant held by a rule where the trial had a story is printed as an `improvement`, and is not a failure.

## What it costs

Measured on a 64-core workstation with a load average of 20 to 37 from other work, `--nice 10`:

| Target | Mutants | Test time | Each | Longest |
| --- | --- | --- | --- | --- |
| import | 60 | 231 s | about 4 s | 4.7 s |
| DecideGroup | 24 | 34 s | about 1.4 s | 2.9 s |
| UndoGroup | 16 | 63 s | about 4 s | 7.4 s |
| UndoRowStep | 21 | 503 s | 20 to 53 s | 52.6 s |
| DecideRow | 27 | 4,572 s | 6 s to 20 min | 1,200 s (`row-open`) |

- `--all --jobs 4`: 5,402 s of test time in 1,413 s of wall time (24 minutes), the baselines included (33 s).
  DecideRow is most of it: a mutant that breaks one of its rules takes the prover one to twenty minutes to confirm
  the counterexample, and one that breaks none takes six seconds. The wall time is bounded below by `row-open`
  alone.
- `--sample`: 21 to 24 s of wall time, each mutant 1 to 4 s.

The result of that run: 116 held by a rule, 32 by a story only, 0 by neither, every one of the trial's 111 still held
by a rule. Five the trial had as a story only are now held by the proof: the four decisions' "records nothing"
(`row-nothing`, `undo-nothing`, `group-nothing`, `gundo-nothing`: the proof's "some state lets it record") and
`undo-history` (the proof's path count, 296 where it expects 298; no rule notices the let-go level).

## The sample

Nine mutants, named with their reason in `SAMPLE` in `run.py`: only the import's commands and the two group
decisions, whose proofs take a second or a few; DecideRow and UndoRowStep are left out, since a broken rule there
takes the prover minutes to confirm. Among them a check, a field and "records nothing", each held by a rule and by a
story only as the trial found (no "records nothing" was held by a rule in the trial: `group-nothing` now is, by the
proof's "some state lets it record").

## Adding a mutant when a check is added to a `decide`

Every check that refuses an act should have a mutant that removes it, and so should every field of a new event. Add
an object to `mutants.json`:

```json
{
  "key": "confirm-sum",
  "target": "import",
  "kind": "check",
  "file": "src/Import/Import.aggregate.ts",
  "anchors": ["Effect.fn(\"Import.ConfirmImport\")"],
  "until": "Effect.fn(\"Import.TakeBackImport\")",
  "old": "        if (cmd.created + cmd.updated + cmd.already + cmd.notImported !== s.rows) {\n          return yield* new CountsDoNotAddUp({})\n        }\n",
  "new": "",
  "proof": "test/Import.prove.test.ts",
  "expect": "rule",
  "trialRules": ["OutcomesAddUpToTheRows"],
  "trialStories": []
}
```

- `key`: `<command>-<what>` for the import (`confirm-sum`), `<row|undo|group|gundo>-<what>` for a decision, and
  `<...>-<event>-<field>` for a field (`group-groupdecided-count`). Unique.
- `target`: `import`, `DecideRow`, `UndoRowStep`, `DecideGroup` or `UndoGroup`. `kind`: `check`, `field` or
  `nothing`.
- `anchors`: texts found in order; the change lands after the last. For the import, the handler
  (`Effect.fn("Import.ConfirmImport")`); for a decision, its `decide` (`Effect.fn("Deciding.decide")`); for a field,
  that, then the event (`new RowDecided({`).
- `until`: where the region ends: the next handler, `    evolve: {` after the last one, `    transitions: {` for a
  decision, `})` for a field of an event written over several lines, `\n` for one written on one line.
- `old`, `new`: the exact text, indentation and line ends included. A removed check is its whole line or lines,
  ending with `\n`, and `new` is `""`. `old` must occur exactly once between the anchors and `until`, or the runner
  refuses the mutant.
- `proof`: the proof file of the target. `expect`: the class it must keep, `rule` for a new check (a check with no rule
  under it is what this catches). `trialRules` and `trialStories`: what was seen to break, or `[]`.

Then run it alone (`--only <key> --keep`) and read `.mutants/<key>/vitest.log` if it is not what you expect. When
the source is reformatted, a mutant whose `old` no longer matches is refused by name: rewrite its text from the file,
never by guessing.
