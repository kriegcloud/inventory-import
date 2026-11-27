// The budget's tests at scale (budget.ts): names given the one before, or a part of it, from a hundred to ten thousand
// of them, and the five heaviest shapes at about a million characters, each ending within the steps its length
// allows. Slow (12 s of the CLI's fast tests on a workstation, several times that on CI's runner), so they run with
// the slow tests, which turbo replays until the CLI changes; the shapes at ordinary sizes stay in Steps.test.ts.
import { describe, expect, it } from "@effect/vitest"
import * as R from "effect/Record"
import { maxFileSize, maxSteps } from "../src/commands/Laws/internal/budget.ts"
import { chainRefShapes, deepTagShapes, refShapes, type Shape, tagShapes, within } from "./support/shapes.ts"

describe("a law ends on any file within its budget, at scale", () => {
  it.each(R.toEntries(chainRefShapes))("the refs law: %s, a hundred to ten thousand", (_, shape) => {
    for (const n of [100, 400, 800, 1000, 4000, 8000, 10_000]) within("refs", shape(n))
  })

  // The shapes slowest to read at the ceiling: each ends within it, refused in words.
  // 8.9 to 9.7 s on two pinned cores alone, near the shared 30 s once the rest of the check runs beside it: 60 s.
  it("the heaviest shapes at a million characters end within the ceiling", () => {
    const heaviest: ReadonlyArray<readonly ["tags" | "refs", Shape | undefined, number]> = [
      ["refs", refShapes["names assigned to each other"], 285],
      ["refs", refShapes["names assigned to each other in every function"], 284],
      ["refs", refShapes["names assigned parts of each other"], 265],
      ["tags", deepTagShapes["records each spread from the two before"], 20_478],
      ["tags", tagShapes["functions that call the next"], 25_555]
    ]
    for (const [law, shape, n] of heaviest) {
      const source = shape === undefined ? "" : shape(n)
      expect(source.length).toBeGreaterThan(900_000)
      expect(source.length).toBeLessThanOrEqual(maxFileSize)
      const read = within(law, source)
      expect([read.steps <= maxSteps, read.unread]).toEqual([true, true])
    }
  }, 60_000)
})
