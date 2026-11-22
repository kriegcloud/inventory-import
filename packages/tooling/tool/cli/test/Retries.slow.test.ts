// The retries are said aloud, and a hang is never passed by one: the real test runner over two small tests, with the
// repository's own `realTime` and reporter (vitest.shared.ts, vitest.retries.ts). Slow, because it starts vitest.
//
// Vitest shows a retry condition only the last error of a try. A hook that fails after a test ran out of time is
// that last error, so vitest tries the test again and it can pass: the reporter is what fails the run.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Str from "effect/String"
import { Repo } from "../src/Repo.service.ts"
import { slowLimits } from "../../../../../vitest.shared.ts"
import { inTree } from "./support/tree.ts"

const here = new URL("../../../../../", import.meta.url).pathname

const config = [
  'import { defineConfig } from "vitest/config"',
  'import { realTime, saidAloud } from "./vitest.shared.ts"',
  'export default defineConfig({ test: { include: ["*.test.ts"], ...realTime, ...saidAloud } })',
  ""
]

/** A test that fails its first try and passes its second: by a plain failure, or by running out of time. */
const flaky = (how: "fails" | "hangs", hook: boolean) =>
  A.join(
    [
      'import { afterEach, expect, it } from "vitest"',
      "let tries = 0",
      ...(hook
        ? ['afterEach(() => { if (tries === 1) throw new Error("the hook looked at what the test never reached") })']
        : []),
      how === "hangs"
        ? 'it("the test", async () => { tries += 1; if (tries === 1) await new Promise((done) => setTimeout(done, 600)); expect(tries).toBe(2) }, 200)'
        : 'it("the test", () => { tries += 1; expect(tries).toBe(2) })',
      ""
    ],
    "\n"
  )

/** Runs vitest over one test file with the repository's retries; its exit code and the reporter's lines. */
const run = (test: string) =>
  inTree(
    { "vitest.config.ts": A.join(config, "\n"), "one.test.ts": test },
    Effect.gen(function* () {
      const repo = yield* Repo
      yield* Effect.forEach(
        ["vitest.shared.ts", "vitest.retries.ts"],
        Effect.fnUntraced(function* (file) {
          const text = yield* repo.text(repo.join(here, file))
          yield* repo.write(repo.join(repo.root, file), text)
        }),
        { concurrency: 1, discard: true }
      )
      yield* repo.run("ln", ["-s", repo.join(here, "node_modules"), repo.join(repo.root, "node_modules")])
      const ran = yield* repo.run("node", [repo.join(here, "node_modules/vitest/vitest.mjs"), "run"], {
        // Not GitHub's runner, wherever this runs: the lines read below are the plain ones.
        env: { GITHUB_ACTIONS: "false" }
      })
      const said = A.filter(Str.split("\n")(ran.stdout), (line) => /^(RETRIED|Retried)/.test(line))
      return {
        code: ran.code,
        said: A.map(said, Str.replace(/^(RETRIED(?: AGAINST THE RULE)?) \S+ {2}/, "$1 <where>  "))
      }
    })
  )

describe("the retries, said aloud", () => {
  it.effect(
    "a test that passed on a second try is named, without a cause it did not check, and the run passes",
    () =>
      Effect.gen(function* () {
        const result = yield* run(flaky("fails", false))
        expect(result).toEqual({
          code: 0,
          said: [
            "RETRIED <where>  passed on try 2 of 2: the test  (first try: expected 1 to be 2 // Object.is equality)",
            "Retried: 1 test(s) passed only on a later try (named above with RETRIED). Why is not known: each is a fault to find, and one that waits in real time belongs on TestClock."
          ]
        })
      }),
    slowLimits.testTimeout
  )

  it.effect(
    "a test that ran out of time fails at once; when a hook's failure hides that from vitest and a later try passes, the run fails all the same",
    () =>
      Effect.gen(function* () {
        const plain = yield* run(flaky("hangs", false))
        expect(plain).toEqual({ code: 1, said: ["Retried: no test needed a second try."] })
        const hidden = yield* run(flaky("hangs", true))
        expect(hidden).toEqual({
          code: 1,
          said: [
            'RETRIED AGAINST THE RULE <where>  the test: tried again after "Test timed out in 200ms.", which ends a test at once. A later error of the same try hid it from vitest\'s retry condition. The run fails.',
            "RETRIED <where>  passed on try 2 of 2: the test  (first try: Test timed out in 200ms.)",
            "Retried: 1 test(s) passed only on a later try (named above with RETRIED). Why is not known: each is a fault to find, and one that waits in real time belongs on TestClock.",
            "Retried against the rule: 1 test(s) were tried again after a hang or a falsified property (named above). The run fails."
          ]
        })
      }),
    slowLimits.testTimeout
  )
})
