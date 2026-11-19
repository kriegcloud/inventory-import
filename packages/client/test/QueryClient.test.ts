// A refetch that answers what is already held keeps the object already held, also when the answer holds Effect
// values. Without it, everything memoized on fetched data is rebuilt on every refetch.
import { describe, expect, it } from "@effect/vitest"
import { sameWhenEqual } from "@inventory/client/QueryClient"
import * as BigDecimal from "effect/BigDecimal"
import * as DateTime from "effect/DateTime"
import * as O from "effect/Option"

const answer = () => ({
  total: 3,
  cost: BigDecimal.fromStringUnsafe("12.50"),
  range: { min: O.some(1), max: O.none<number>() },
  rows: [{ id: "a", at: DateTime.makeUnsafe("2026-01-01T00:00:00.000Z"), note: O.some("x") }]
})

describe("what a refetch keeps", () => {
  it("is the held object when the answer says the same, with options, a decimal and a moment in it", () => {
    const held = answer()
    expect(sameWhenEqual(held, answer())).toBe(held)
  })

  it("is the new answer when it says something else, with the parts that did not change kept", () => {
    const held = answer()
    const next = { ...answer(), total: 4 }
    const kept = sameWhenEqual(held, next)
    expect(kept).not.toBe(held)
    expect(kept).toEqual(next)
  })
})
