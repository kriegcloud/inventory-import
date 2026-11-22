// Every template runs as written: `scratch new` makes an experiment from each, and then the real test runner and
// the real type-checker, with the Effect diagnostics, pass over all of them. Slow, because it starts both.
//
// The experiments are made in a temporary repository, not in this one's scratchpad: its `scratchpad/package.json`,
// tsconfig and vitest configuration are this repository's own files, and its `node_modules` is a link to this
// repository's, so `effect` and every workspace package resolve as they do for a real experiment.
//
// What the test runner found is read from its JSON report, never from what it prints: its summary line is coloured
// on CI (`CI` is set there) and not in a terminal, and a test that read it passed here and failed on GitHub.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { type Install, scratchNew } from "../src/commands/Scratch/Scratch.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { inTree } from "./support/tree.ts"

/** The parts of vitest's JSON report the test reads. */
const Report = S.Struct({
  success: S.Boolean,
  numTotalTests: S.Int,
  numPassedTests: S.Int,
  testResults: S.Array(S.Struct({ name: S.String, status: S.String, message: S.String }))
})

const here = new URL("../../../../../", import.meta.url).pathname
const noInstall: Install = Effect.succeed({ code: 0, output: "" })
const copied = [
  "tsconfig.base.json",
  "scratchpad/package.json",
  "scratchpad/tsconfig.json",
  "scratchpad/vitest.config.ts"
]

describe("the scratchpad's templates", () => {
  it.effect(
    "a probe, a service and a screen pass their tests and the type-checker as `scratch new` writes them",
    () =>
      Effect.gen(function* () {
        const result = yield* inTree(
          {},
          Effect.gen(function* () {
            const repo = yield* Repo
            yield* Effect.forEach(
              copied,
              Effect.fnUntraced(function* (file) {
                const text = yield* repo.text(repo.join(here, file))
                yield* repo.write(repo.join(repo.root, file), text)
              }),
              { concurrency: 1, discard: true }
            )
            yield* repo.run("ln", ["-s", repo.join(here, "node_modules"), repo.join(repo.root, "node_modules")])
            yield* Effect.forEach(
              ["probe", "service", "screen"] as const,
              (template) => scratchNew({ name: `try-${template}`, template, question: "" }, noInstall),
              { concurrency: 1, discard: true }
            )
            const scratch = repo.join(repo.root, "scratchpad")
            const ran = yield* repo.run(
              "node",
              [repo.join(here, "node_modules/vitest/vitest.mjs"), "run", "--reporter=json", "--outputFile=report.json"],
              { cwd: scratch }
            )
            const report = yield* repo.json(Report)(repo.join(scratch, "report.json"))
            const tests = { code: ran.code, report }
            const types = yield* repo.run(repo.join(here, "node_modules/.bin/tsrs"), ["-p", "tsconfig.json"], {
              cwd: scratch
            })
            return { tests, types }
          })
        )
        const { code, report } = result.tests
        expect({
          code,
          success: report.success,
          // One entry for each test file: the report's "suites" count each `describe` too.
          files: `${A.filter(report.testResults, (file) => file.status === "passed").length} of ${report.testResults.length}`,
          tests: `${report.numPassedTests} of ${report.numTotalTests}`,
          failed: A.flatMap(report.testResults, (file) =>
            file.status === "passed" ? [] : [`${file.name}: ${file.message}`]
          )
        }).toEqual({ code: 0, success: true, files: "3 of 3", tests: "4 of 4", failed: [] })
        expect({ code: result.types.code, said: `${result.types.stdout}${result.types.stderr}` }).toEqual({
          code: 0,
          said: ""
        })
      }),
    // A nested vitest and type-check over the scratchpad: 1.2 s alone on two pinned cores when warm, far more when
    // cold beside the rest of the check. 120 s is the shared limit of a slow test; a hang fails inside the job.
    120_000
  )
})
