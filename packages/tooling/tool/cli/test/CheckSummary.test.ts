import { assert, describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as S from "effect/Schema"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Result from "effect/Result"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { pipe } from "effect/Function"
import { checkRun } from "../src/commands/Check/Check.command.ts"
import { Repo } from "../src/Repo.service.ts"
import { checkSummary, checkSentence } from "../src/commands/Check/CheckSummary.rules.ts"
import { CheckFinding, TurboLogLine } from "../src/commands/Check/CheckSummary.schema.ts"
import { inTree, json } from "./support/tree.ts"

const task = (taskId: string, exitCode: number, directory = "", logFile = `.turbo/${taskId}.log`) => ({
  taskId,
  directory,
  logFile,
  execution: { exitCode }
})
const record = (tasks: ReadonlyArray<unknown>, failed: number, attempted: number) =>
  json({ execution: { exitCode: failed > 0 ? 1 : 0, attempted, failed }, tasks })

describe("check summary", () => {
  it.effect(
    "keeps both laws' refusals, locates tsrs and oxlint errors, and ignores passing and never-started logs",
    () =>
      inTree(
        {
          ".turbo/runs/001.json": record(
            [
              task("//#defaults:check", 1),
              task("//#assertions:check", 1),
              task("@x/model#check", 2, "packages/model", "packages/model/.turbo/turbo-check.log"),
              { taskId: "@x/pass#test", directory: "packages/pass", execution: { exitCode: 0 } },
              { taskId: "@x/blocked#check", directory: "packages/blocked" }
            ],
            3,
            4
          ),
          ".turbo///#defaults:check.log":
            "root:defaults:check: packages/catalog/model/src/Words.rules.ts  holds 1 fallback, and may hold 0: Put the starting value on the schema",
          ".turbo///#assertions:check.log":
            "\u001b[31mpackages/catalog/model/src/Words.rules.ts:20:67: error: Forbidden non-null assertion. Use Option instead\u001b[0m",
          "packages/model/.turbo/turbo-check.log":
            "src/Words.rules.ts(17,14): error TS2322: Type string is not assignable to number"
        },
        Effect.gen(function* () {
          const findings = yield* checkSummary()
          const failures = A.filter(findings, CheckFinding.guards.TaskFailed)
          expect(failures).toHaveLength(3)
          const defaults = A.findFirst(failures, (finding) => finding.task === "//#defaults:check")
          const defaultsPresent = O.isSome(defaults)
          assert(defaultsPresent)
          expect(A.head(defaults.value.lines).pipe(O.flatMap((line) => line.file))).toEqual(
            O.some("packages/catalog/model/src/Words.rules.ts")
          )
          const typed = A.findFirst(failures, (finding) => finding.task === "@x/model#check")
          const typedPresent = O.isSome(typed)
          assert(typedPresent)
          const line = A.head(typed.value.lines)
          const linePresent = O.isSome(line)
          assert(linePresent)
          expect(line.value.file).toEqual(O.some("packages/model/src/Words.rules.ts"))
          expect(line.value.line).toEqual(O.some(17))
          expect(
            A.join(
              A.map(findings, (finding) => checkSentence(finding).text),
              "\n"
            )
          ).toContain("Put the starting value on the schema")
          expect(
            A.last(findings).pipe(
              O.map(checkSentence),
              O.map((line) => line.text)
            )
          ).toEqual(O.some("3 of 4 tasks failed"))
        })
      )
  )

  it.effect("caps matched lines at ten and links the overflow, while unfamiliar logs use their last eight lines", () =>
    inTree(
      {
        ".turbo/runs/002.json": record([task("many", 1), task("odd", 1)], 2, 2),
        ".turbo/many.log": A.join(
          A.makeBy(13, (n) => `error ${n}`),
          "\n"
        ),
        ".turbo/odd.log": A.join(
          A.makeBy(12, (n) => `unfamiliar ${n}\n`),
          "\n"
        )
      },
      Effect.gen(function* () {
        const findings = yield* checkSummary()
        const failures = A.filter(findings, CheckFinding.guards.TaskFailed)
        const many = A.head(failures)
        const manyPresent = O.isSome(many)
        assert(manyPresent)
        expect(many.value.lines).toHaveLength(10)
        expect(many.value.shown).toBe(13)
        expect(checkSentence(many.value).text).toContain("and 3 more in .turbo/many.log")
        const odd = A.last(failures)
        const oddPresent = O.isSome(odd)
        assert(oddPresent)
        expect(A.map(odd.value.lines, (line) => line.text)).toEqual(A.makeBy(8, (n) => `unfamiliar ${n + 4}`))
      })
    )
  )

  it.effect("keeps Vitest failure headings and error locations", () =>
    inTree(
      {
        ".turbo/runs/001.json": record([task("test", 1, "packages/model")], 1, 1),
        ".turbo/test.log":
          "FAIL test/Words.test.ts > words\nAssertionError: expected true to be false\n ❯ test/Words.test.ts:8:2"
      },
      Effect.gen(function* () {
        const findings = yield* checkSummary()
        const failures = A.filter(findings, CheckFinding.guards.TaskFailed)
        const failure = A.head(failures)
        const failurePresent = O.isSome(failure)
        assert(failurePresent)
        expect(failure.value.lines).toHaveLength(3)
        const location = A.last(failure.value.lines)
        const locationPresent = O.isSome(location)
        assert(locationPresent)
        expect(location.value.file).toEqual(O.some("packages/model/test/Words.test.ts"))
      })
    )
  )

  it.effect("puts the failing test before logged warnings, and a failure printed twice once", () =>
    inTree(
      {
        ".turbo/runs/001.json": record([task("test:slow", 1, "apps/inventory")], 1, 1),
        ".turbo/test:slow.log": A.join(
          [
            ...A.flatMap(
              A.makeBy(6, (n) => n),
              (n) => [
                `stderr | test/server/Auth.slow.test.ts:${n + 10} > sign-in > case ${n}`,
                `2026-11-27T05:14:44.520Z WARN [Better Auth]: Base URL is not set. Set the baseURL option, or use a dynamic baseURL (${n})`
              ]
            ),
            " ✓  slow  test/server/QueryPlans.slow.test.ts (1 test) 1065ms",
            " × a replace keeps a copy 22662ms",
            " FAIL  slow  test/server/ItemChecks.slow.test.ts:90 > a replace keeps a copy",
            "Error: Property falsified after 38 run(s) and 0 shrink(s)",
            "Failure: AssertionError: expected false to be true",
            " ❯ test/server/ItemChecks.slow.test.ts:103:42",
            " FAIL  slow  test/server/ItemChecks.slow.test.ts:90 > a replace keeps a copy",
            "Error: Property falsified after 38 run(s) and 0 shrink(s)"
          ],
          "\n"
        )
      },
      Effect.gen(function* () {
        const findings = yield* checkSummary()
        const failure = A.findFirst(findings, CheckFinding.guards.TaskFailed)
        const failurePresent = O.isSome(failure)
        assert(failurePresent)
        expect(A.map(A.take(failure.value.lines, 5), (line) => line.text)).toEqual([
          "× a replace keeps a copy 22662ms",
          "FAIL  slow  test/server/ItemChecks.slow.test.ts:90 > a replace keeps a copy",
          "Error: Property falsified after 38 run(s) and 0 shrink(s)",
          "Failure: AssertionError: expected false to be true",
          "❯ test/server/ItemChecks.slow.test.ts:103:42"
        ])
        expect(failure.value.shown).toBe(18)
        expect(A.every(A.drop(failure.value.lines, 5), (line) => /stderr \||WARN|✓/.test(line.text))).toBe(true)
      })
    )
  )

  it.effect("reports NoRun when no record exists", () =>
    inTree(
      {},
      Effect.gen(function* () {
        const findings = yield* checkSummary()
        expect(A.every(findings, CheckFinding.guards.NoRun)).toBe(true)
      })
    )
  )

  it.effect("reads the newest record and handles a failed task with no saved log", () =>
    inTree(
      {
        ".turbo/runs/001.json": record([], 0, 10),
        ".turbo/runs/002.json": record([{ taskId: "//#missing", directory: "", execution: { exitCode: 1 } }], 1, 1)
      },
      Effect.gen(function* () {
        const findings = yield* checkSummary()
        const failure = A.findFirst(findings, CheckFinding.guards.TaskFailed)
        const failurePresent = O.isSome(failure)
        assert(failurePresent)
        expect(checkSentence(failure.value).text).toContain("Log is empty")
        expect(
          A.last(findings).pipe(
            O.map(checkSentence),
            O.map((line) => line.text)
          )
        ).toEqual(O.some("1 of 1 tasks failed"))
      })
    )
  )
  it.effect("prints a passing standalone summary on stdout", () =>
    inTree(
      {
        ".turbo/runs/001.json": record([], 0, 12)
      },
      Effect.gen(function* () {
        const findings = yield* checkSummary()
        expect(A.map(findings, checkSentence)).toEqual([{ to: "out", text: "0 of 12 tasks failed" }])
      })
    )
  )

  it.effect("preserves a child's nonzero exit code when it writes no turbo record", () =>
    inTree(
      {},
      Effect.gen(function* () {
        const result = yield* checkRun(["sh", "-c", "exit 7"]).pipe(Effect.result)
        const failed = Result.isFailure(result)
        assert(failed)
        expect(result.failure).toMatchObject({ code: 7 })
      })
    )
  )

  it.effect("preserves repeated arguments and adds each runner flag once", () =>
    inTree(
      {},
      Effect.gen(function* () {
        yield* checkRun([
          "sh",
          "-c",
          'printf "%s\\n" "$@" > received.txt',
          "runner",
          "same",
          "same",
          "--continue",
          "--summarize",
          "--continue"
        ])
        const repo = yield* Repo
        const received = yield* repo.text(repo.join(repo.root, "received.txt"))
        expect(received).toBe("same\nsame\n--continue\n--summarize\n--log-file=.turbo/check-output.json\n")
      })
    )
  )
  it.effect("retains the newest ten JSON run records and leaves other files alone", () =>
    inTree(
      {
        ...R.fromEntries(A.makeBy(12, (n) => [`.turbo/runs/${n + 100}.json`, "{}"])),
        ".turbo/runs/keep.txt": "keep"
      },
      Effect.gen(function* () {
        yield* checkRun(["sh", "-c", "exit 0"])
        const repo = yield* Repo
        const entries = yield* repo.entries(repo.join(repo.root, ".turbo/runs"))
        expect(
          pipe(
            entries,
            A.map((entry) => entry.name),
            A.sort(Str.Order)
          )
        ).toEqual([
          "102.json",
          "103.json",
          "104.json",
          "105.json",
          "106.json",
          "107.json",
          "108.json",
          "109.json",
          "110.json",
          "111.json",
          "keep.txt"
        ])
      })
    )
  )
  it.effect("retains document and configuration refusals with their named paths", () =>
    inTree(
      {
        ".turbo/runs/001.json": record([task("docs", 1)], 1, 1),
        ".turbo/docs.log":
          "docs/guide.md  missing description; add the frontmatter field\n.github/workflows/ci.yml:12:3: invalid mapping"
      },
      Effect.gen(function* () {
        const findings = yield* checkSummary()
        const failure = A.findFirst(findings, CheckFinding.guards.TaskFailed)
        const found = O.isSome(failure)
        assert(found)
        expect(A.map(failure.value.lines, (line) => line.file)).toEqual([
          O.some("docs/guide.md"),
          O.some(".github/workflows/ci.yml")
        ])
      })
    )
  )
  it.effect("reads what this run printed, not the log file an earlier run of an uncached task left", () =>
    inTree(
      {
        ".turbo/runs/001.json": record([task("//#format:check", 1, "", ".turbo/turbo-format.log")], 1, 1),
        ".turbo/turbo-format.log": "All matched files use the correct format.",
        ".turbo/runs/001.log": json([
          { source: "//#format:check", text: "packages/x/src/New.ts (2ms)" },
          { source: "//#format:check", text: "Format issues found in above 1 files. Run without `--check` to fix." }
        ])
      },
      Effect.gen(function* () {
        const findings = yield* checkSummary()
        const failure = A.findFirst(findings, CheckFinding.guards.TaskFailed)
        const found = O.isSome(failure)
        assert(found)
        const said = checkSentence(failure.value).text
        expect(said).toContain("  packages/x/src/New.ts (2ms)")
        expect(said).not.toContain("packages/x/src/New.ts  packages/x/src/New.ts")
        expect(said).not.toContain("correct format")
        expect(failure.value.log).toBe(".turbo/runs/001.log")
      })
    )
  )
  it.effect("reads uncached law output from the structured companion when turbo saved no task log", () =>
    inTree(
      {
        ".turbo/runs/001.json": record(
          [{ taskId: "//#defaults:check", directory: "", execution: { exitCode: 1 } }],
          1,
          1
        ),
        ".turbo/runs/001.log": json([
          { source: "turbo", text: "runner info" },
          {
            source: "//#defaults:check",
            text: "packages/catalog/model/src/Words.rules.ts  holds a fallback: Put the starting value on the schema"
          },
          { source: "//#defaults:check", text: "packages/catalog/model/src/Words.rules.ts:16  xs[0]!" }
        ])
      },
      Effect.gen(function* () {
        const findings = yield* checkSummary()
        const failure = A.findFirst(findings, CheckFinding.guards.TaskFailed)
        const found = O.isSome(failure)
        assert(found)
        expect(failure.value.lines).toHaveLength(2)
        expect(checkSentence(failure.value).text).toContain("Put the starting value on the schema")
        expect(failure.value.log).toBe(".turbo/runs/001.log")
      })
    )
  )
  it.prop("structured task output generates only valid values", [Arbitrary.schema(TurboLogLine)], ([line]) => {
    expect(S.is(TurboLogLine)(line)).toBe(true)
  })
  it.effect("retains a formatter's bare file path and its repair instruction", () =>
    inTree(
      {
        ".turbo/runs/001.json": record([task("format", 1)], 1, 1),
        ".turbo/format.log":
          'packages/catalog/model/src/Words.rules.ts (0ms)\nFormat issues found in above 1 files. Run without `--check` to fix.\nerror: script "format:check" exited with code 1'
      },
      Effect.gen(function* () {
        const findings = yield* checkSummary()
        const failure = A.findFirst(findings, CheckFinding.guards.TaskFailed)
        const found = O.isSome(failure)
        assert(found)
        expect(A.head(failure.value.lines).pipe(O.flatMap((line) => line.file))).toEqual(
          O.some("packages/catalog/model/src/Words.rules.ts")
        )
        expect(checkSentence(failure.value).text).toContain("Run without `--check` to fix")
      })
    )
  )
})
