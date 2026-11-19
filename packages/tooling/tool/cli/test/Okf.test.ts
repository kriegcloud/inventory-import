import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { okf } from "../src/commands/Docs/Okf.rules.ts"
import { inTree, printed } from "./support/tree.ts"

const validatorPath = ".agents/skills/okf-open-knowledge-format/scripts/validate.sh"

// A stand-in for the vendored validator: it answers from a file in the bundle it is given.
const validator = '#!/usr/bin/env bash\ncat "$1/answer"\nexit "$(cat "$1/code")"\n'

const bundle = (name: string, answer: string, code = "0") => ({
  [`${name}/a.md`]: "",
  [`${name}/answer`]: answer,
  [`${name}/code`]: code
})
const good = "W1: a warning\nFiles scanned: 1\nBundle is OKF v0.2 conformant\n"

describe("docs check", () => {
  it.effect("prints each bundle's warnings and its one line when all three conform", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          [validatorPath]: validator,
          ...bundle("docs", good),
          ...bundle("explorations", good),
          ...bundle("goals", good)
        },
        okf(false)
      )
      expect(report.failed).toBe(false)
      expect(printed(report)).toEqual([
        "out: W1: a warning",
        "out: docs:check OK  all 1 markdown files in docs/ conform to OKF v0.2 (--verbose for the full report)",
        "out: W1: a warning",
        "out: docs:check OK  all 1 markdown files in explorations/ conform to OKF v0.2 (--verbose for the full report)",
        "out: W1: a warning",
        "out: docs:check OK  all 1 markdown files in goals/ conform to OKF v0.2 (--verbose for the full report)"
      ])
    })
  )

  it.effect("stops at the first bundle the validator refuses, with its report", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          [validatorPath]: validator,
          ...bundle("docs", good),
          ...bundle("explorations", "E1: no frontmatter\nFiles scanned: 1\n", "1"),
          ...bundle("goals", good)
        },
        okf(false)
      )
      expect(report.failed).toBe(true)
      const lines = printed(report)
      expect(lines[2]).toBe("out: E1: no frontmatter\nFiles scanned: 1")
      expect(lines[3]).toMatch(/^err: docs:check FAIL {2}explorations\/ is not a conformant OKF bundle\./)
      expect(lines).toHaveLength(4)
    })
  )

  it.effect("refuses a validator that says conformant after scanning nothing", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        { [validatorPath]: validator, ...bundle("docs", "Files scanned: 0\nBundle is OKF v0.2 conformant\n") },
        okf(false)
      )
      expect(printed(report).at(-1)).toBe(
        "err: docs:check FAIL  the validator scanned 0 files of the 1 in docs/, so it did not run properly."
      )
    })
  )

  it.effect("refuses a bundle with no markdown, and a repository without the validator", () =>
    Effect.gen(function* () {
      const empty = yield* inTree({ [validatorPath]: validator, "docs/a.txt": "" }, okf(false))
      expect(printed(empty)).toEqual(["err: docs:check FAIL  there are no markdown files under docs/."])
      const none = yield* inTree({ "docs/a.md": "" }, okf(false))
      expect(printed(none)[0]).toMatch(
        /^err: docs:check FAIL {2}the OKF validator is missing \(.*validate\.sh\): the okf-open-knowledge-format skill is not installed\.$/
      )
    })
  )
})
