# Mutants of the review's model

What the proofs and the stories of the review are worth is measured by breaking the model on purpose and seeing
whether anything notices. A **mutant** is one change to the model's source, made in a copy of the package:

- **check**: one check of a `decide` removed (`if (!isOpen(s)) return yield* new NotOpen({})` goes), 78 of them;
- **field**: one field of an event given a wrong value (`by: actor.memberId` becomes `by: actor.organizationId`), 80;
- **nothing**: an accepted act made to record nothing (`return []` before the events), 11.

They cover the import's seven commands (`src/Import/Import.aggregate.ts`) and the four decisions
(`src/Review/{Deciding,Undoing,DecidingGroup,UndoingGroup}.decision.ts`). Each runs against its proof
(`test/Import.prove.test.ts` or the decision's `test/*.prove.test.ts`) and both story files
(`test/Review.story.test.ts`, `test/Group.story.test.ts`). The result is one of these classes:

| Class | What failed | What it means |
| --- | --- | --- |
| `rule` | the proof, naming a rule | a rule is no longer proved: it notices the change for every state and input |
| `proof` | the proof, on no rule | only a number the proof test states moved (its count of paths, "some state lets it record"): the change is seen, and no rule says it is wrong |
| `story` | only a story | an example shows the change is wrong, but no rule says so: the next change of the same kind may pass both |
| `neither` | nothing | the change goes unnoticed: a gap, to be closed by a rule or a story |
| `timeout` | nothing but a test that ran out of time | nothing is known: no rule and no story held it |
| `error` | a file did not load, or no result | nothing is known |

A test that ran out of time has noticed nothing, in the proof file or in a story file: the runner counts it apart,
writes it in the note, and never lets it make a class. So a mutant whose proof only timed out is not `rule`, and one
whose only failing story timed out is not `story`; a mutant with nothing else is `timeout`, and fails the run.

An earlier trial of this model ran 148 of these changes and found 111 held by a rule, 37 by a story only and 0 by
neither. Each mutant in `mutants.json` keeps what was found for it (`expect`, the rules seen to break in
`trialRules`, the stories in `trialStories`). A run compares with that by name, not by class alone: a mutant kept as
`rule` is `same` only when the proof still names every rule in its `trialRules` (the name, whatever its standing:
"violated" and "not proved" are both the rule noticing), and is `weaker` when one of them is no longer named, or when
no rule is named at all and only the count of paths moved. A mutant kept as `story` is `same` while a story fails,
whatever the proof's numbers do, and `weaker` when none does.

Six were added since, all in `Deciding`, when its `decide` came to ask `covered` once and make each side's checks
there: the three refusals on the covered side (`row-saw-covered`, `row-nolonger-covered`, `row-madeon-covered`), the
"no change" of a row that holds nothing (`row-same-untouched`), the covered "no change" removed (`row-covered`), and
the covered "no change" answered before the checks of what the sender saw (`row-covered-early`). Each keeps what its
first run found: a rule for five, and for `row-covered-early` a story only (the press from a screen that is behind,
in `test/Group.story.test.ts`). No rule can hold that one: a rule is checked only on a path that records, and an act
answered "no change" records nothing.

Five more came with the press held when its screen is behind a group (2026-11-22: "Hold it when behind"), each kept
as held by a story, for the same reason (the four on the uncovered side also change the proof's count of paths, which
a run prints as an improvement; no rule notices them): the uncovered "no change" of a press whose sender has not seen what the row
holds, removed (`row-same-unseen`, and `row-same-untouched-unseen` on a row with no decision) or answered whether or
not a group was made since (`row-same-behind`, `row-same-untouched-behind`), and the covered "no change" answered
before the check of the matching (`row-covered-before-matching`).

Six more came with the cases settled by that rule: the same text on a newer matching answered "no change"
(`row-same-matching`, and `row-same-unseen-matching` from a screen that has not seen the row's decision), the refusal
that says what the sender saw was taken back, removed (`row-putback`, `row-putback-covered`), the covered press sent
twice no longer known (`row-resend-covered`), and a row's undo taken from under a later group (`undo-covered`). A rule
holds the first and the last; the others are kept as held by their stories.

Four more came with the undo sent twice (2026-11-22): the answer to a second sending removed (`undo-resend`, kept as
held by its story: an act answered with nothing recorded has no rule), and the three fields of `StepUndone` by which a
row knows the undo it took, each given a wrong value (`undo-stepundone-undo`, `undo-stepundone-step`,
`undo-stepundone-by`), each held by its own rule.

## Where they run

The sample is the turbo task `mutants:sample` (`bun run --cwd packages/catalog/model mutants:sample`), part of
`bun run check:full` and of CI's proofs job, replayed until what the mutants read changes. All of them are the task
`mutants`, which the nightly workflow runs in a job of its own (`.github/workflows/proofs-nightly.yml`, four at a time).
Neither is in `bun run check` or in CI's main job.

## Commands

From `packages/catalog/model` (the runner finds its paths from its own place, so any folder works):

```sh
python3 -I mutants/run.py --sample              # nine fast mutants, about 25 s
python3 -I mutants/run.py --all --jobs 4        # all 169
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

It exits 1 when a mutant is held by `neither`, when all that is known of one is a `timeout`, when one is `weaker`
(above), when a mutant does not apply, or when a run gave no result; each is printed with its change and what ran,
and a `weaker` one with the rules no longer named. A mutant held by a rule where a story was kept is printed as an
`improvement`, and is not a failure. The unchanged copy must pass with no test out of time, or nothing more is run.

## What it costs

The run below is of the first 148. The six added since took 20 to 170 s each when run six at a time.

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
- `proof`: the proof file of the target. `expect`: `rule` or `story`, what must go on holding it; `rule` for a new
  check (a check with no rule under it is what this catches: the count of paths moving is class `proof`, and is not
  enough). `trialRules`: the rules seen to break, each of which must stay named (`"Violated <rule>"` or the bare
  name; only the name is compared). `trialStories`: the stories seen to fail.

Then run it alone (`--only <key> --keep`) and read `.mutants/<key>/vitest.log` if it is not what you expect. When
the source is reformatted, a mutant whose `old` no longer matches is refused by name: rewrite its text from the file,
never by guessing.
