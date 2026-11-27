// The usage contract's one schema generates only values it accepts (schema-first rule SF-7), and holds exactly the
// three purposes of `inv:ModelCallPurposeScheme`.
import { describe, expect, it } from "@effect/vitest"
import { dailyModelCalls, ModelCallPurpose } from "@inventory/usage-contract/ModelCall"
import * as Arbitrary from "effect/Arbitrary"
import * as A from "effect/Array"
import * as S from "effect/Schema"

describe("ModelCallPurpose", () => {
  it.prop(
    "generates only valid values",
    [Arbitrary.schema(ModelCallPurpose)],
    ([value]) => {
      expect(S.is(ModelCallPurpose)(value)).toBe(true)
    },
    { arbitrary: { runs: 50 } }
  )

  it("is the three purposes, and nothing else", () => {
    expect(A.map(["view", "check", "suggest", "other", ""], S.is(ModelCallPurpose))).toEqual([
      true,
      true,
      true,
      false,
      false
    ])
  })
})

describe("dailyModelCalls", () => {
  it("is forty", () => {
    expect(dailyModelCalls).toBe(40)
  })
})
