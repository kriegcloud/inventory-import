# Mutants of the review's model

What the proofs and the stories of the review are worth is measured by breaking the model on purpose and seeing
whether anything notices. A **mutant** is one change to the model's source, made in a copy of the package:

- **check**: one check of a `decide` removed (`if (!isOpen(s)) return yield* new NotOpen({})` goes), 93 of them;
- **field**: one field of an event given a wrong value (`by: actor.memberId` becomes `by: actor.organizationId`), 80;
- **nothing**: an accepted act made to record nothing (`return []` before the events), 11.

They cover the import's seven commands (`src/Import/Import.aggregate.ts`) and the four decisions
(`src/Review/{Deciding,Undoing,DecidingGroup,UndoingGroup}.decision.ts`). Each runs against its proof
(`test/Import.prove.test.ts` or the decision's `test/*.prove.test.ts`) and both story files
(`test/Review.story.test.ts`, `test/Group.story.test.ts`). The result is one of these classes:

| Class | What failed | What it means |
| --- | --- | --- |
| `rule` | the proof, with a rule violated | the solver found a state and a command on which the changed code breaks a rule: the rule notices the change |
| `proof` | the proof, with no rule violated | a number the proof test states moved (its count of paths, "some state lets it record"), or the prover did not finish with a rule ("not decided": its time or work limit, or too many paths), could not read the changed code ("not read", "read wrongly"), did not confirm what it found ("not proved"), or marked a rule only because its command may leave the schema: the change is seen, and no rule is shown to forbid it |
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
`rule` is `same` only when the proof still gives every rule in its `trialRules` as violated, and is `weaker` when one
of them is no longer violated, or when none is and the proof failed for another reason. A mutant kept as `story` is `same` while a story fails,
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
holds the last. The others are kept as held by their stories, the first included: with the same text on a newer
matching answered "no change", the proof names two rules as not proved, but that is the prover's reading of the
changed comparison, not a rule that forbids the answer (an act answered "no change" records nothing, and a rule is
checked only where something is recorded). What holds it is the story of the same decision made again on a newer
matching.

Four more came with the undo sent twice (2026-11-22): the answer to a second sending removed (`undo-resend`, kept as
held by its story: an act answered with nothing recorded has no rule), and the three fields of `StepUndone` by which a
row knows the undo it took, each given a wrong value (`undo-stepundone-undo`, `undo-stepundone-step`,
`undo-stepundone-by`), each held by its own rule.

Ten more came with a second review the same day. Held by a rule: the check that a press has the row's last undo
(`row-undone`), a row's undo made on an older matching (`undo-madeon`), and the import's half of "this row, this
group, is of the import the undo names", which had no rule and no mutant of its own (`undo-rowowner-import`,
`gundo-groupowner-import`). Held by a story, since each answers a press with nothing recorded: the covered press
sent twice known with one of its three conditions gone (`row-resend-covered-step`, `row-resend-covered-by`,
`row-resend-covered-text`), and the same press sent again after a match no longer known, or known without its step
or its sender (`row-resend-matched`, `row-resend-matched-step`, `row-resend-matched-by`). And `undo-history`, kept
until then as noticed only by the proof's count of paths, is held by a rule now: an undo stops where the history
was let go.

Five more came when an undo's copy was answered as the first time after a group act or a reopening landed between
the two sendings, each held by a story: the answer removed in each of those two refusals (`undo-resend-grouped`,
`undo-resend-reopened`), and the test of "the row took this very undo" with one of its three conditions gone
(`undo-resend-step`, `undo-resend-by`, `undo-resend-change`).

One was moved from a rule to a story when "held by a rule" came to mean a rule violated: `takeback-imported` (the
check that an import is imported, or open, before a take-back). Without it the prover cannot read the take-back at
all and gives every rule of the import as "not read", which is no rule noticing. Its stories hold it.

## Where they run

The sample is the turbo task `mutants:sample` (`bun run --cwd packages/catalog/model mutants:sample`), part of
`bun run check:full` and of CI's proofs job, replayed until what the mutants read changes. All of them are the task
`mutants`, which the nightly workflow runs in a job of its own (`.github/workflows/proofs-nightly.yml`, four at a time),
with the one slow mutant left out of it and run alone in another job (below, "What it costs").
Neither is in `bun run check` or in CI's main job.

## Commands

From `packages/catalog/model` (the runner finds its paths from its own place, so any folder works):

```sh
python3 -I mutants/run.py --sample              # nine fast mutants, about 25 s
python3 -I mutants/run.py --all --jobs 4        # all 191
python3 -I mutants/run.py --all --except row-open   # all but the ones named
python3 -I mutants/run.py --only confirm-sum,group-madeon
python3 -I mutants/run.py --list                # every mutant, and nothing run
```

Flags: `--jobs N` (mutants at once, default 2), `--keep` (keep each copy in `.mutants/<key>/`, with its
`result.json` and `vitest.log`), `--no-baseline`, `--nice N` (default 10), `--timeout S` (seconds before a run is
stopped, default 3600), `--except key1,key2` (leave these out; a run left with nothing fails), `--proof-limit S`
(seconds a proof test may take, set in each copy only; it must be below `--timeout`, since a run stopped from outside
leaves no result to read). It needs `bun install` to have run (it uses the repository's `node_modules/.bin/vitest`) and
`node` on the path, and nothing else: Python 3, standard library only.

What a run does: every chosen mutant is first checked to apply to the package's text, and one kept as held by a
rule to record each of its rules as violated (a `trialRules` entry on any other standing is refused: the prover giving
up holds nothing); then, for each proof file the
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

Measured on 2026-11-22 on a 64-core workstation busy with other work (load average 18 to 40), `--nice 5`, ten at a
time: one run of all 190.

| Target | Mutants | Test time | Longest |
| --- | --- | --- | --- |
| import | 60 | 360 s | 8 s |
| DecideGroup | 24 | 64 s | 6 s |
| UndoGroup | 17 | 115 s | 10 s |
| UndoRowStep | 33 | 1,266 s | 75 s |
| DecideRow | 56 | 7,953 s | 1,544 s (`row-open`) |

- `--all --jobs 10`: 9,757 s of test time in 1,622 s of wall time (27 minutes), the baselines included. DecideRow
  is most of it: a mutant that breaks one of its rules takes the prover minutes to confirm the counterexample, and
  one that breaks none takes ten seconds. The wall time is bounded below by `row-open` alone.
- `row-open` (the check that the import is open, removed) is the slow one: 1,544 s in that run, held by its five
  rules (1,531 s run alone). In an earlier run at a load near 100 it passed the 25 minutes its proof test then
  had, and was counted as nothing and failed, as a test out of time must be. The
  proof test's limit stays 50 minutes, below the hour a run is given, and the nightly runs this mutant apart: the
  job of all mutants leaves it out (`--except row-open`), and a job of its own runs it alone with the proof's limit
  made 100 minutes in its copy (`--only row-open --jobs 1 --proof-limit 6000 --timeout 6600`), so that
  running out of time there fails that job, named for it, and says nothing of the other 190. On GitHub's runner,
  at about half this machine's speed, it would take about 51 minutes: an estimate, not measured there. A run that
  only ran out of time still fails, as it must: nothing is known of the mutant then.
- `--sample`: about 25 s of wall time, each mutant 1 to 4 s.

The result of that one run: all 190 as recorded, none held by neither, none out of time. Held by a rule violated:
124. By the proof's own numbers or its "not decided" and "not read", with a story failing too: 38. By a story only:
28. Every mutant kept as held by a rule is held by every rule recorded for it, each given as violated.

One mutant was added after that run, so there are 191: `undo-undone`, the check that a row's undo is made on a
screen that has the row's last undo, held by its rule violated. The 51 mutants of the two undos were run again with
it, four at a time, and all came out as recorded (371 s of wall time); the other 140 were not run again.

## The sample

Nine mutants, named with their reason in `SAMPLE` in `run.py`: only the import's commands and the two group
decisions, whose proofs take a second or a few; DecideRow and UndoRowStep are left out, since a broken rule there
takes the prover minutes to confirm. Among them a check, a field and "records nothing", each held by a rule and by a
story only as recorded (`group-nothing` is held by its stories, and the proof's "some state lets it record" notices
it too: class `proof`).

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
