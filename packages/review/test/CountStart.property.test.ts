import { describe, it } from "@effect/vitest"
import { strictEqual, deepStrictEqual } from "@effect/vitest/utils"
import * as Arbitrary from "effect/Arbitrary"
import * as S from "effect/Schema"
import { CountStart, FacetStart } from "../src/internal/CountStart.schema.ts"
import { ReviewText } from "../src/internal/ReviewText.rules.ts"

describe("new facet groups and comparison text", () => {
  it.prop("count starts generate valid values", [Arbitrary.schema(CountStart)], ([value]) => {
    strictEqual(S.is(CountStart)(value), true)
  })
  it.prop("facet starts generate valid values", [Arbitrary.schema(FacetStart)], ([value]) => {
    strictEqual(S.is(FacetStart)(value), true)
  })
  it.prop("comparison transforms every typed string into trimmed text", [Arbitrary.schema(S.String)], ([text]) => {
    strictEqual(S.is(S.Trimmed)(ReviewText.comparison(text)), true)
  })
  it.prop(
    "comparison keeps the text between the spaces it takes off",
    [Arbitrary.schema(S.Trimmed), Arbitrary.schema(S.Literals(["", " ", "\t", "\n ", "\u00A0"]))],
    ([text, space]) => {
      strictEqual(ReviewText.comparison(`${space}${text}${space}`), text)
    }
  )
  it("keeps each facet group's mutable spelling dictionary independent", () => {
    const a = FacetStart.make({})
    const b = FacetStart.make({})
    a.spellings["Packaging"] = 2
    deepStrictEqual(b.spellings, {})
    strictEqual(a.n, 0)
    strictEqual(CountStart.make({}).value, 0)
  })
  it("keeps source spelling intact while reading Unicode whitespace and case", () => {
    const source = "\uFEFF\u2002 Foot \t\n"
    strictEqual(ReviewText.comparison(source), "Foot")
    strictEqual(source, "\uFEFF\u2002 Foot \t\n")
    strictEqual(ReviewText.comparison("  \t"), "")
    strictEqual(ReviewText.word("İTEM SKU"), "i\u0307tem sku")
    strictEqual(ReviewText.capital("Straße"), "STRASSE")
    strictEqual(ReviewText.facet("\u00A0 Packaging \r\n"), "packaging")
  })
})
