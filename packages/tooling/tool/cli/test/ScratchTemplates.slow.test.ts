// Every template runs as written: `scratch new` makes an experiment from each, and then the real test runner and
// the real type-checker, with the Effect diagnostics, pass over all of them. Slow, because it starts both.
//
// The experiments are made in a temporary repository, not in this one's scratchpad: its `scratchpad/package.json`,
// tsconfig and vitest configuration are this repository's own files, and its `node_modules` is a link to this
// repository's, so `effect` and every workspace package resolve as they do for a real experiment.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Str from "effect/String"
import { type Install, scratchNew } from "../src/commands/Scratch/Scratch.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { inTree } from "./support/tree.ts"

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
            const tests = yield* repo.run("node", [repo.join(here, "node_modules/vitest/vitest.mjs"), "run"], {
              cwd: scratch
            })
            const types = yield* repo.run(repo.join(here, "node_modules/.bin/tsrs"), ["-p", "tsconfig.json"], {
              cwd: scratch
            })
            return { tests, types }
          })
        )
        const passed = A.filter(Str.split("\n")(result.tests.stdout), Str.includes("Test Files"))
        expect({
          code: result.tests.code,
          files: A.map(passed, Str.trim),
          errors: result.tests.code === 0 ? "" : result.tests.stderr
        }).toEqual({
          code: 0,
          files: ["Test Files  3 passed (3)"],
          errors: ""
        })
        expect({ code: result.types.code, said: `${result.types.stdout}${result.types.stderr}` }).toEqual({
          code: 0,
          said: ""
        })
      }),
    600_000
  )
})
