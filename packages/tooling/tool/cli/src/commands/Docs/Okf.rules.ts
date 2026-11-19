/**
 * `docs/`, `explorations/` and `goals/` are each an Open Knowledge Format (v0.2) bundle, by the validator the OKF
 * skill ships (`.agents/skills/okf-open-knowledge-format/scripts/validate.sh`, vendored unchanged).
 *
 * The validator is someone else's bash and stays bash: this rule runs it. What is this repository's own is here: the
 * three bundles, the guard that the tools the validator needs are installed, and the refusal to pass when it looked
 * at nothing. It can pass without looking: it reads the file list through `find | sort -z`, and if that fails it
 * scans nothing and still says "conformant".
 *
 * @packageDocumentation
 */
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Str from "effect/String"
import type { RepoError } from "../../Cli.errors.ts"
import { Repo } from "../../Repo.service.ts"
import { err, failed, type Line, out, passed } from "../../Report.schema.ts"

const bundles = ["docs", "explorations", "goals"] as const
const tools = ["find", "sort", "grep", "sed", "awk", "xargs", "date"] as const

/** The sentence every refusal starts with. */
const fail = (text: string): Line => err(`docs:check FAIL  ${text}`)

/** What one step found: the lines so far, and whether to stop there. */
interface Step {
  readonly lines: ReadonlyArray<Line>
  readonly stop: boolean
}

/**
 * Validates the three bundles in order and stops at the first that fails; `verbose` prints the validator's full
 * report for each.
 *
 * @category rules
 */
export const okf = Effect.fn("Okf.okf")(function* (verbose: boolean) {
  const repo = yield* Repo
  const validator = repo.join(repo.root, ".agents/skills/okf-open-knowledge-format/scripts/validate.sh")
  if (!(yield* repo.exists(validator))) {
    return failed([
      fail(`the OKF validator is missing (${validator}): the okf-open-knowledge-format skill is not installed.`)
    ])
  }
  const present = yield* Effect.forEach(
    tools,
    (tool) => repo.run("bash", ["-c", 'command -v "$1"', "_", tool]).pipe(Effect.map((answer) => answer.code === 0)),
    { concurrency: 1 }
  )
  const missing = A.findFirst(A.zip(tools, present), ([, found]) => !found)
  if (O.isSome(missing)) {
    return failed([fail(`'${missing.value[0]}' is not installed. The OKF validator needs it.`)])
  }
  const sortZ = yield* repo.run("bash", ["-c", "printf 'a\\0' | sort -z"])
  if (sortZ.code !== 0) {
    return failed([fail("this 'sort' has no -z option. The OKF validator needs GNU or BSD sort.")])
  }

  const checkBundle = Effect.fn("Okf.checkBundle")(function* (bundle: string): Effect.fn.Return<Step, RepoError> {
    const files = yield* repo.files(repo.join(repo.root, bundle))
    const expected = A.filter(files, Str.endsWith(".md")).length
    if (expected === 0) return { lines: [fail(`there are no markdown files under ${bundle}/.`)], stop: true }
    // Both of the validator's streams as one, in the order it wrote them.
    const answer = yield* repo.run("bash", ["-c", 'bash "$0" "$1" 2>&1', validator, bundle])
    const report = Str.replace(/\n+$/, "")(answer.stdout)
    const reportLines = Str.split("\n")(report)
    const scanned = A.join(
      A.flatMap(reportLines, (line) => {
        const match = /^Files scanned: ([0-9][0-9]*)$/.exec(line)
        return match === null ? A.empty<string>() : A.of(match[1] ?? "")
      }),
      "\n"
    )
    if (answer.code !== 0 || !Str.includes("Bundle is OKF v0.2 conformant")(report)) {
      return {
        lines: [
          out(report),
          fail(
            `${bundle}/ is not a conformant OKF bundle. Fix each E line above: a file outside index.md and log.md starts on\n` +
              "    line 1 with a --- frontmatter block that has type:, and only docs/index.md may have frontmatter among the\n" +
              "    index.md files. The okf-open-knowledge-format skill has the rules; any file in docs/standards/ shows the fields."
          )
        ],
        stop: true
      }
    }
    if (scanned !== String(expected)) {
      return {
        lines: [
          out(report),
          fail(
            `the validator scanned ${scanned === "" ? "no" : scanned} files of the ${expected} in ${bundle}/, so it did not run properly.`
          )
        ],
        stop: true
      }
    }
    const shown = verbose
      ? A.of(out(report))
      : A.map(
          A.filter(reportLines, (line) => /W[0-9]*: /.test(line)),
          out
        )
    return {
      lines: A.append(
        shown,
        out(
          `docs:check OK  all ${expected} markdown files in ${bundle}/ conform to OKF v0.2 (--verbose for the full report)`
        )
      ),
      stop: false
    }
  })

  const first = yield* checkBundle(bundles[0])
  if (first.stop) return failed(first.lines)
  const second = yield* checkBundle(bundles[1])
  if (second.stop) return failed(A.appendAll(first.lines, second.lines))
  const third = yield* checkBundle(bundles[2])
  const lines = A.flatten([first.lines, second.lines, third.lines])
  return third.stop ? failed(lines) : passed(lines)
})
