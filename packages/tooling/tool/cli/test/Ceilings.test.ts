import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { ceilings, ceilingsSentence } from "../src/commands/Quality/Ceilings.rules.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, printed } from "./support/tree.ts"

const ceilingFile = (ceiling: number) =>
  json({ project: "tsconfig.json", own: ["src/"], vendored: [], rules: ["preferEffectArray"], ceiling })

describe("quality ceilings", () => {
  it.effect("adds up every package's ceiling and passes at the cap", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          "apps/shop/strict-ceiling.json": ceilingFile(600),
          "packages/ui/strict-ceiling.json": ceilingFile(78)
        },
        Effect.map(ceilings(), render(ceilingsSentence))
      )
      expect(report.failed).toBe(false)
      expect(printed(report)).toEqual([
        "out:   apps/shop: 600",
        "out:   packages/ui: 78",
        "out: ceilings:check  sum 678, cap 678"
      ])
    })
  )

  it.effect("fails one above the cap, and says the sum", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          "apps/shop/strict-ceiling.json": ceilingFile(600),
          "packages/ui/strict-ceiling.json": ceilingFile(79)
        },
        Effect.map(ceilings(), render(ceilingsSentence))
      )
      expect(report.failed).toBe(true)
      expect(printed(report).at(-1)).toBe("err: ceilings:check FAIL  the stage C ceilings add up to 679, above 678")
    })
  )
})
