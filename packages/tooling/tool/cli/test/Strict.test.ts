import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import { Finding, groupFindings, strict, stripJsonc } from "../src/commands/Quality/Strict.rules.ts"
import { inTree, json, printed } from "./support/tree.ts"

const finding = (file: string, line: number, name: string) => Finding.make({ file, line, column: 1, name })

const plugin = (extra: Record<string, unknown>) =>
  json({ compilerOptions: { plugins: [{ name: "@effect/language-service", ...extra, overrides: [{ any: 1 }] }] } })

describe("quality strict", () => {
  it("reads a tsconfig with comments and trailing commas, and leaves strings alone", () => {
    expect(stripJsonc('{\n  // a comment\n  "a": "// not one", /* gone */ "b": [1, 2,],\n}')).toBe(
      '{\n  \n  "a": "// not one",  "b": [1, 2]\n}'
    )
  })

  it("groups findings by rule, most first then by name, each finding once", () => {
    const grouped = groupFindings([
      finding("a.ts", 1, "preferEffectString"),
      finding("a.ts", 2, "preferEffectArray"),
      finding("a.ts", 2, "preferEffectArray"),
      finding("b.ts", 3, "preferEffectRecord"),
      finding("b.ts", 4, "preferEffectRecord")
    ])
    expect(grouped.total).toBe(4)
    expect(A.map(grouped.rules, ([rule, found]) => `${rule} ${found.length}`)).toEqual([
      "preferEffectRecord 2",
      "preferEffectArray 1",
      "preferEffectString 1"
    ])
  })

  it.effect("refuses a package whose plugin options drifted from the root's, before it counts anything", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          "tsconfig.base.json": plugin({ strict: true }),
          "packages/ui/package.json": json({ name: "@x/ui" }),
          "packages/ui/tsconfig.base.json": plugin({ strict: false })
        },
        strict(O.none(), false),
        "packages/ui"
      )
      expect(report.failed).toBe(true)
      expect(printed(report)).toEqual([
        "err: check:strict FAIL  the package's plugin options differ from the root's outside `overrides`: copy the root's block again",
        "err: check:strict FAIL  name the ceiling file: beep-cli quality strict strict-ceiling.json"
      ])
    })
  )

  it.effect("says so when no tsconfig up the chain has the plugin", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          "tsconfig.base.json": json({ compilerOptions: {} }),
          "packages/ui/package.json": json({ name: "@x/ui" }),
          "packages/ui/tsconfig.base.json": '{\n  // inherits\n  "extends": "../../tsconfig.base.json",\n}'
        },
        strict(O.some("strict-ceiling.json"), false),
        "packages/ui"
      )
      expect(printed(report)).toEqual([
        "err: check:strict FAIL  no @effect/language-service plugin in tsconfig.base.json"
      ])
    })
  )
})
