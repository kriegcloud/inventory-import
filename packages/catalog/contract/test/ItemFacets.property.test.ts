// What the Items filters offer is counted over every item of the organization, and every item has a category, a unit,
// and both switches: so each list's counts add up to the items, a value no item has is left out, and a range is there
// exactly when there are items, lowest first. All data is generated from the schemas; the oracle adds the counts.
import { describe, expect, it } from "@effect/vitest"
import { Category, Uom } from "@inventory/catalog-contract/Item"
import { ItemFacets } from "@inventory/catalog-contract/ItemQuery"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as O from "effect/Option"
import * as S from "effect/Schema"

const runs = { arbitrary: { runs: 200 } }

type Listed = ReadonlyArray<{ readonly value: string; readonly count: number }>
const sum = (listed: Listed): number => A.reduce(listed, 0, (n, entry) => n + entry.count)
const values = (listed: Listed): ReadonlyArray<string> => A.map(listed, (entry) => entry.value)
const lists = (facets: ItemFacets): ReadonlyArray<Listed> => [
  facets.category,
  facets.uom,
  facets.isActive,
  facets.lotTracked
]

describe("what the Items filters offer", () => {
  it.prop(
    "counts every item once in each list, and leaves out a value no item has",
    [Arbitrary.schema(ItemFacets)],
    ([facets]) => {
      for (const listed of lists(facets)) {
        expect(sum(listed)).toBe(facets.total)
        expect(A.every(listed, (entry) => entry.count >= 1)).toBe(true)
        expect(A.dedupe(values(listed)).length).toBe(listed.length)
      }
    },
    runs
  )

  it.prop(
    "offers only values an item can have",
    [Arbitrary.schema(ItemFacets)],
    ([facets]) => {
      expect(A.every(values(facets.category), S.is(Category))).toBe(true)
      expect(A.every(values(facets.uom), S.is(Uom))).toBe(true)
      for (const listed of [facets.isActive, facets.lotTracked]) {
        expect(A.every(values(listed), (value) => value === "true" || value === "false")).toBe(true)
      }
    },
    runs
  )

  it.prop(
    "has a range exactly when there are items, its lowest no higher than its highest and never below zero",
    [Arbitrary.schema(ItemFacets)],
    ([facets]) => {
      for (const range of [facets.quantityOnHand, facets.unitCost]) {
        expect([O.isSome(range.min), O.isSome(range.max)]).toEqual([facets.total > 0, facets.total > 0])
        if (O.isSome(range.min) && O.isSome(range.max)) {
          expect(range.min.value).toBeGreaterThanOrEqual(0)
          expect(range.min.value).toBeLessThanOrEqual(range.max.value)
        }
      }
      for (const end of [facets.quantityOnHand.min, facets.quantityOnHand.max]) {
        expect(O.exists(end, (n) => !Number.isInteger(n))).toBe(false)
      }
    },
    runs
  )

  it.prop(
    "is refused when a list's counts do not add up to the items, or a range is upside down",
    [Arbitrary.schema(ItemFacets)],
    ([facets]) => {
      expect(S.is(ItemFacets)({ ...facets, total: facets.total + 1 })).toBe(false)
      const { min, max } = facets.unitCost
      if (O.isSome(min) && O.isSome(max) && min.value < max.value) {
        expect(S.is(ItemFacets)({ ...facets, unitCost: { min: max, max: min } })).toBe(false)
      }
    },
    runs
  )
})
