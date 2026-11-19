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
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import type { RepoError } from "../../Cli.errors.ts"
import { Repo } from "../../Repo.service.ts"
import { err, type Line, out } from "../../Report.schema.ts"

const bundles = ["docs", "explorations", "goals"] as const
const tools = ["find", "sort", "grep", "sed", "awk", "xargs", "date"] as const

const $I = $RepoCliId.create("commands/Docs/Okf.rules")
const bundleKey = S.String.pipe(S.annotateKey({ description: "The bundle's folder" }))

/**
 * What `docs check` finds: per bundle, the validator's warnings and that it conforms; or the one refusal it stops at.
 *
 * @category schemas
 */
export const OkfFinding = S.TaggedUnion({
  ValidatorMissing: {
    validator: S.String.pipe(S.annotateKey({ description: "Where the validator should be, absolute" }))
  },
  ToolMissing: { tool: S.String.pipe(S.annotateKey({ description: "The tool the validator needs and did not find" })) },
  SortWithoutZ: {},
  NoMarkdown: { bundle: bundleKey },
  Printed: { text: S.String.pipe(S.annotateKey({ description: "The validator's report, or one warning line of it" })) },
  NotConformant: { bundle: bundleKey },
  ScannedWrong: {
    bundle: bundleKey,
    scanned: S.String.pipe(
      S.annotateKey({ description: "How many files the validator said it scanned; empty when it said none" })
    ),
    expected: S.Int.pipe(S.annotateKey({ description: "How many markdown files the bundle has" }))
  },
  Conformant: {
    bundle: bundleKey,
    files: S.Int.pipe(S.annotateKey({ description: "How many markdown files it has" }))
  }
}).pipe(
  $I.annoteSchema("OkfFinding", { description: "A conformant bundle with its warnings, or the refusal it stops at" })
)

/**
 * The decoded value of `OkfFinding`.
 *
 * @category models
 */
export type OkfFinding = typeof OkfFinding.Type

/** The sentence every refusal starts with. */
const fail = (text: string): Line => err(`docs:check FAIL  ${text}`)

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const okfSentence: (finding: OkfFinding) => Line = OkfFinding.match({
  ValidatorMissing: ({ validator }) =>
    fail(`the OKF validator is missing (${validator}): the okf-open-knowledge-format skill is not installed.`),
  ToolMissing: ({ tool }) => fail(`'${tool}' is not installed. The OKF validator needs it.`),
  SortWithoutZ: () => fail("this 'sort' has no -z option. The OKF validator needs GNU or BSD sort."),
  NoMarkdown: ({ bundle }) => fail(`there are no markdown files under ${bundle}/.`),
  Printed: ({ text }) => out(text),
  NotConformant: ({ bundle }) =>
    fail(
      `${bundle}/ is not a conformant OKF bundle. Fix each E line above: a file outside index.md and log.md starts on\n` +
        "    line 1 with a --- frontmatter block that has type:, and only docs/index.md may have frontmatter among the\n" +
        "    index.md files. The okf-open-knowledge-format skill has the rules; any file in docs/standards/ shows the fields."
    ),
  ScannedWrong: ({ bundle, scanned, expected }) =>
    fail(
      `the validator scanned ${scanned === "" ? "no" : scanned} files of the ${expected} in ${bundle}/, so it did not run properly.`
    ),
  Conformant: ({ bundle, files }) =>
    out(`docs:check OK  all ${files} markdown files in ${bundle}/ conform to OKF v0.2 (--verbose for the full report)`)
})

/** What one bundle found, and whether to stop there. */
interface Step {
  readonly found: ReadonlyArray<OkfFinding>
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
    return A.of<OkfFinding>({ _tag: "ValidatorMissing", validator })
  }
  const present = yield* Effect.forEach(
    tools,
    (tool) => repo.run("bash", ["-c", 'command -v "$1"', "_", tool]).pipe(Effect.map((answer) => answer.code === 0)),
    { concurrency: 1 }
  )
  const missing = A.findFirst(A.zip(tools, present), ([, found]) => !found)
  if (O.isSome(missing)) {
    return A.of<OkfFinding>({ _tag: "ToolMissing", tool: missing.value[0] })
  }
  const sortZ = yield* repo.run("bash", ["-c", "printf 'a\\0' | sort -z"])
  if (sortZ.code !== 0) {
    return A.of<OkfFinding>({ _tag: "SortWithoutZ" })
  }

  const checkBundle = Effect.fn("Okf.checkBundle")(function* (bundle: string): Effect.fn.Return<Step, RepoError> {
    const files = yield* repo.files(repo.join(repo.root, bundle))
    const expected = A.filter(files, Str.endsWith(".md")).length
    if (expected === 0) return { found: [{ _tag: "NoMarkdown", bundle }], stop: true }
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
        found: [
          { _tag: "Printed", text: report },
          { _tag: "NotConformant", bundle }
        ],
        stop: true
      }
    }
    if (scanned !== String(expected)) {
      return {
        found: [
          { _tag: "Printed", text: report },
          { _tag: "ScannedWrong", bundle, scanned, expected }
        ],
        stop: true
      }
    }
    const shown: ReadonlyArray<OkfFinding> = verbose
      ? [{ _tag: "Printed", text: report }]
      : A.map(
          A.filter(reportLines, (line) => /W[0-9]*: /.test(line)),
          (text) => ({ _tag: "Printed", text })
        )
    return { found: A.append(shown, { _tag: "Conformant", bundle, files: expected }), stop: false }
  })

  const first = yield* checkBundle(bundles[0])
  if (first.stop) return first.found
  const second = yield* checkBundle(bundles[1])
  if (second.stop) return A.appendAll(first.found, second.found)
  const third = yield* checkBundle(bundles[2])
  return A.flatten([first.found, second.found, third.found])
})
