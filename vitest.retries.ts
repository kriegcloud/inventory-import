// Says aloud every test that passed only on a second try, so nothing passes that way unseen.
//
// Benjamin's decision of 2026-11-22 ("Retry for now, said aloud; remove after TestClock"): the tests that wait in
// real time are tried again until they are moved onto `TestClock`, and every test that needed it is named. This
// reporter names it in the run's output (file, line, test, which try passed, what the failed tries said) and, on
// GitHub, as a warning on that line of the file (`::warning file=…`). At the end of each run it says how many.
//
// It goes with `realTime` in vitest.shared.ts, in the same change that moves the last of those tests onto TestClock.
import * as A from "effect/Array"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
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
  private readonly retried: Array<Retried> = []

  onTestCaseResult(testCase: TestCase) {
    const attempts = testCase.attempts()
    const failed = A.filter(attempts, (attempt) => attempt.state === "failed")
    if (testCase.result().state !== "passed" || failed.length === 0) return
    const found: Retried = {
      file: fromRoot(testCase.module.moduleId),
      line: testCase.location?.line ?? 1,
      name: testCase.fullName,
      tries: attempts.length,
      first: `${Str.split("\n")(failed[0]?.errors?.[0]?.message ?? "no message")[0]}`
    }
    this.retried.push(found)
    process.stdout.write(
      `RETRIED ${found.file}:${found.line}  passed on try ${found.tries} of ${found.tries}: ${found.name}  (first try: ${found.first})\n`
    )
    if (onGitHub) {
      process.stdout.write(
        `::warning file=${found.file},line=${found.line},title=Passed on try ${found.tries}::${escaped(`${found.name}. It failed ${failed.length} time(s) first: ${found.first}. It waits in real time; move it onto TestClock.`)}\n`
      )
    }
  }

  onTestRunEnd(_modules: ReadonlyArray<TestModule>) {
    const count = this.retried.length
    process.stdout.write(
      count === 0
        ? "Retried: no test needed a second try.\n"
        : `Retried: ${count} test(s) passed only on a later try (named above with RETRIED). Each waits in real time.\n`
    )
  }
}

/**
 * The reporters of a test run that tries tests again: vitest's own, and this one. On GitHub vitest's own are the
 * default and its GitHub reporter, which writes a failure as an annotation; naming reporters replaces vitest's list,
 * so both are named here.
 */
export const retriedReporters = [...(onGitHub ? ["default", "github-actions"] : ["default"]), new RetriedTests()]
