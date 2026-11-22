// @effect-diagnostics nodeBuiltinImport:off
// Every template runs as written: `scratch new` makes an experiment from each, and then the real test runner and
// the real type-checker, with the Effect diagnostics, pass over all of them. Slow, because it starts both.
//
// The experiments are made in a temporary repository, not in this one's scratchpad: its scratchpad is built from the
// configuration the CLI keeps (Scratch.config.ts), so nothing of this repository's scratchpad is read, and its
// `node_modules` is a link to this repository's root install, so `effect` and every workspace package resolve as they
// do for a real experiment.
//
// What the test runner found is read from its JSON report, never from what it prints: its summary line is coloured
// on CI (`CI` is set there) and not in a terminal, and a test that read it passed here and failed on GitHub.
import { existsSync } from "node:fs"
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { scratchpadFiles } from "../src/commands/Scratch/Scratch.config.ts"
import { scratchNew } from "../src/commands/Scratch/Scratch.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { slowLimits } from "../../../../../vitest.shared.ts"
import { inTree } from "./support/tree.ts"

/** The parts of vitest's JSON report the test reads. */
const Report = S.Struct({
  success: S.Boolean,
  numTotalTests: S.Int,
  numPassedTests: S.Int,
  testResults: S.Array(S.Struct({ name: S.String, status: S.String, message: S.String }))
})

const here = new URL("../../../../../", import.meta.url).pathname
// The Verify template needs the prover, which is installed at the root only once a package asks for it. Until then
// this test says plainly that it did not run it, and the template is checked by hand.
const proverInstalled = existsSync(new URL("node_modules/@alchemy.run/domain/package.json", `file://${here}`))
const templates = proverInstalled
  ? (["probe", "service", "screen", "verify"] as const)
  : (["probe", "service", "screen"] as const)

const copied = ["tsconfig.base.json"]

describe("the scratchpad's templates", () => {
  it.effect(
    proverInstalled
      ? "a probe, a service, a screen and a Verify model pass their tests and the type-checker as `scratch new` writes them"
      : "a probe, a service and a screen pass their tests and the type-checker as `scratch new` writes them (the Verify template is not run: @alchemy.run/domain is not installed at the root)",
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
            // The scratchpad, as the CLI keeps it: its package.json and its three configuration files.
            yield* Effect.forEach(
              scratchpadFiles,
              (file) => repo.write(repo.join(repo.root, "scratchpad", file.name), file.text),
              { concurrency: 1, discard: true }
            )
            yield* repo.run("ln", ["-s", repo.join(here, "node_modules"), repo.join(repo.root, "node_modules")])
            yield* Effect.forEach(
              templates,
              (template) => scratchNew({ name: `try-${template}`, template, question: "" }),
              { concurrency: 1, discard: true }
            )
            const scratch = repo.join(repo.root, "scratchpad")
            const ran = yield* repo.run(
              "node",
              // Its own module cache: through the linked `node_modules` vitest would use this repository's, see another
              // lockfile, and clear it under the other packages' tests running beside this one.
              [
                repo.join(here, "node_modules/vitest/vitest.mjs"),
                "run",
                "--reporter=json",
                "--outputFile=report.json",
                `--fsModuleCachePath=${repo.join(repo.root, ".vitest-cache")}`
              ],
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
        }).toEqual({
          code: 0,
          success: true,
          files: proverInstalled ? "4 of 4" : "3 of 3",
          tests: proverInstalled ? "6 of 6" : "4 of 4",
          failed: []
        })
        expect({ code: result.types.code, said: `${result.types.stdout}${result.types.stderr}` }).toEqual({
          code: 0,
          said: ""
        })
      }),
    slowLimits.testTimeout
  )
})
