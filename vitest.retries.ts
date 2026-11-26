// Says aloud every test that passed only on a second try, so nothing passes that way unseen.
//
// Benjamin's decision of 2026-11-22 ("Retry for now, said aloud; remove after TestClock"): the tests that wait in
// real time are tried again until they are moved onto `TestClock`, and every test that needed it is named. This
// reporter names it in the run's output (file, line, test, which try passed, what the failed tries said) and, on
// GitHub, as a warning on that line of the file (`::warning file=…`). At the end of each run it says how many.
//
// It says what happened and never why: a test that passed on a later try failed for a reason nobody has read yet.
// Every test of a package that uses `realTime` is tried again, not only the ones that wait, so the fault may be
// anything: a wait in real time, a test that leans on what another left behind, a real fault that shows only
// sometimes.
//
// It also holds the rule vitest cannot: a hang or a falsified property is never tried again. Vitest asks its retry
// condition about the last error of a try only, so a hook that fails after a hang hides the hang and the test is
// tried again. This reporter reads every error of every try; when it finds a try that should have ended the test,
// it says so and fails the run, even if a later try passed.
//
// It goes with `realTime` in vitest.shared.ts, in the same change that moves the last of those tests onto TestClock.
import * as A from "effect/Array"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as MutableRef from "effect/MutableRef"
import * as O from "effect/Option"
import * as Str from "effect/String"
import type { Reporter, TestCase, TestModule } from "vitest/node"

/** The repository's root: this file's folder. Paths in a GitHub annotation are from it. */
const root = `${import.meta.dirname}/`

/** A file's path from the root. */
const fromRoot = (file: string) => (Str.startsWith(root)(file) ? Str.slice(root.length)(file) : file)

/** Whether the run is on GitHub's runner, which reads a `::warning` line as an annotation. */
const onGitHub = Config.String("GITHUB_ACTIONS").pipe(
  Config.option,
  Effect.runSync,
  O.exists((value) => value === "true")
)

/**
 * What ends a test at once, wherever it is among a try's errors: a property that was falsified (another try draws
 * other values and would hide a counterexample that is real), and a test or hook that ran out of time (a hang tried
 * again eats the job's time four times over). `realTime`'s condition in vitest.shared.ts is built from it.
 */
export const neverTriedAgain = /Property falsified|(?:Test|Hook) timed out in \d+ms/

/** One test that failed and then passed. */
interface Retried {
  readonly file: string
  readonly line: number
  readonly name: string
  readonly tries: number
  readonly first: string
}

/** GitHub reads a workflow command's message up to the line's end: one line, with `%` and line breaks escaped. */
const escaped = (text: string) =>
  Str.replaceAll("\n", "%0A")(Str.replaceAll("\r", "%0D")(Str.replaceAll("%", "%25")(text)))

/** The reporter: add it beside the default one in a package whose tests are tried again. */
export class RetriedTests implements Reporter {
  private readonly retried = MutableRef.make<ReadonlyArray<Retried>>([])
  private readonly againstTheRule = MutableRef.make<ReadonlyArray<string>>([])

  onTestCaseResult(testCase: TestCase) {
    const attempts = testCase.attempts()
    const failed = A.filter(attempts, (attempt) => attempt.state === "failed")
    // A try that should have been the last, and was not: every try but the last is one the test was tried again after.
    const hidden = A.flatMap(A.dropRight(attempts, 1), (attempt) =>
      A.filter(
        A.map(attempt.errors ?? [], (error) => `${Str.split("\n")(error.message ?? "")[0]}`),
        (message) => neverTriedAgain.test(message)
      )
    )
    if (A.isArrayNonEmpty(hidden)) {
      const where = `${fromRoot(testCase.module.moduleId)}:${testCase.location?.line ?? 1}`
      MutableRef.update(this.againstTheRule, A.append(where))
      process.stdout.write(
        `RETRIED AGAINST THE RULE ${where}  ${testCase.fullName}: tried again after "${hidden[0]}", which ends a test at once. A later error of the same try hid it from vitest's retry condition. The run fails.\n`
      )
      if (onGitHub) {
        process.stdout.write(
          `::error file=${fromRoot(testCase.module.moduleId)},line=${testCase.location?.line ?? 1},title=Tried again against the rule::${escaped(`${testCase.fullName} was tried again after "${hidden[0]}". A hang or a falsified property is never tried again; a later error of the same try hid it.`)}\n`
        )
      }
    }
    if (testCase.result().state !== "passed" || failed.length === 0) return
    const found: Retried = {
      file: fromRoot(testCase.module.moduleId),
      line: testCase.location?.line ?? 1,
      name: testCase.fullName,
      tries: attempts.length,
      first: `${Str.split("\n")(failed[0]?.errors?.[0]?.message ?? "no message")[0]}`
    }
    MutableRef.update(this.retried, A.append(found))
    process.stdout.write(
      `RETRIED ${found.file}:${found.line}  passed on try ${found.tries} of ${found.tries}: ${found.name}  (first try: ${found.first})\n`
    )
    if (onGitHub) {
      process.stdout.write(
        `::warning file=${found.file},line=${found.line},title=Passed on try ${found.tries}::${escaped(`${found.name}. It failed ${failed.length} time(s) first: ${found.first}. Why is not known: find the fault. A test that waits in real time belongs on TestClock.`)}\n`
      )
    }
  }

  onTestRunEnd(_modules: ReadonlyArray<TestModule>) {
    const count = MutableRef.get(this.retried).length
    process.stdout.write(
      count === 0
        ? "Retried: no test needed a second try.\n"
        : `Retried: ${count} test(s) passed only on a later try (named above with RETRIED). Why is not known: each is a fault to find, and one that waits in real time belongs on TestClock.\n`
    )
    const againstTheRule = MutableRef.get(this.againstTheRule)
    if (A.isArrayNonEmpty(againstTheRule)) {
      process.stdout.write(
        `Retried against the rule: ${againstTheRule.length} test(s) were tried again after a hang or a falsified property (named above). The run fails.\n`
      )
      // Vitest reads this when it ends: a run whose every test passed on a later try still fails.
      process.exitCode = 1
    }
  }
}

/**
 * The reporters of a test run that tries tests again: vitest's own, and this one. On GitHub vitest's own are the
 * default and its GitHub reporter, which writes a failure as an annotation; naming reporters replaces vitest's list,
 * so both are named here.
 */
export const retriedReporters = [...(onGitHub ? ["default", "github-actions"] : ["default"]), new RetriedTests()]
