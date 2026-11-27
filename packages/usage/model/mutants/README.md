# Mutants of the usage model

What the allowance's proof and its tests are worth, measured by breaking the model on purpose. The runner, the
classes (`rule`, `proof`, `story`, `neither`, `timeout`, `error`), how a run compares with what each mutant keeps, and
how to add one are the review's: `packages/catalog/model/mutants/README.md`. This page says only what is here.

`mutants.json` holds 39 mutants, each run against the allowance's proof (`test/Allowance.prove.test.ts`) and the three
test files it names in `stories`: the stories (`test/Allowance.story.test.ts`), the rule of what is left
(`test/AllowanceLeft.test.ts`) and the Apis' test (`test/UsageApi.test.ts`, the only one that runs the middleware and
the view's `validate` from a client).

| Target | File | What is changed |
| --- | --- | --- |
| `TakeCall` (23) | `src/Allowance/Allowance.aggregate.ts` | each check of `decide` (the role, the organization, the order of the two, the day's limit, each half of the day's rollover), the refusals' fields, the day worked out from the clock, each field `CallTaken` keeps (organization, day, who, purpose) on a day's first call and on a later one, and each call made to record nothing |
| `evolve` (6) | the same | the same-day test, the count, the day and the organization each case keeps |
| `AllowanceToday` (5) | `src/Allowance/AllowanceToday.view.ts` | the view's fold (the same-day test, the count, the day) and its `validate` |
| `AllowanceLeft` (5) | `src/Allowance/AllowanceLeft.rules.ts` | `dayOf`'s rounding, and `leftOn`'s comparison of days, its floor at zero and its full day |

How the expectations were recorded, on 2026-11-27, six at a time. The first run of the first 37 exited 1: one did not
apply (`takecall-next-calltaken-day`, its old text found twice) and three came out `error` with no result
(`takecall-viewer`, `takecall-otherorg`, `view-validate`). The three were a test failing with a value that has no
message: vitest's JSON report then writes `null` among the test's failure messages, and the runner's schema
(`TestCase.failureMessages` in `packages/tooling/tool/cli/src/commands/Mutants/Mutants.schema.ts`) refuses the whole
report. `test/UsageApi.test.ts` compares each answer through `answerOf` for that reason, until the runner reads a
`null` there. With the one mutant's text made unique, the second run had every mutant recorded as `story`, and the 16
held by a rule read `improvement`; its results became the recorded expectations. The run after that exited 0, every
mutant as recorded: 16 held by a rule violated, 4 by the proof's own numbers with a story failing too, 17 by a story
only.

Two were added after review and recorded from their own run: `takecall-rollover-fresh` (the rollover's
`AllowanceState.guards.Fresh(s) ||` half removed; the proof fails `TakeCall: not supported` on every rule, so it is
held by the proof's numbers, and by eight stories) and `takecall-order` (the organization asked before the role, the
order Benjamin chose on 2026-11-27; held by the proof's path count and by the story of a viewer of another
organization told the role first). A run of all 39 then exited 0, every one as recorded (16 s of wall time): 16 held
by a rule violated, 6 by the proof's own numbers with a story failing too, 17 by a story only; none by neither, none
out of time, no error. Four are held by a rule and by no story: a call counted against a day behind the
stored one (`takecall-rollover-backward`, `takecall-next-calltaken-day`) and a new day taking the event's
organization (`evolve-sameday-organization`, `evolve-newday-organization`). A story cannot show the first two: the
story's clock does not move back. Every mutant of the view and of `AllowanceLeft` is held by a test only: no proof
reads either.

```sh
bun run beep mutants packages/usage/model --sample     # the six of the sample, a few seconds
bun run beep mutants packages/usage/model --all --jobs 4
```

From this folder the same is `beep-cli mutants . --sample` (the `mutants:sample` script) and `beep-cli mutants . --all`
(`mutants`). The sample is in `bun run check:full`; all of them run every night in a job of their own
(`.github/workflows/proofs-nightly.yml`, `usage-mutants`).
