// What the Items filters offer is counted over every item of the organization, and every item has a category, a unit,
// and both switches: so each list's counts add up to the items, a value no item has is left out, and a range is there
// exactly when there are items, lowest first. Facets are generated from the schema, then broken one rule at a time;
// each broken copy must be refused, so every rule of the check is seen to hold on its own. Three rules no copy can
// break alone, since others imply them: a list's length (each value is listed once), a whole total (the counts are
// whole and add up to it) and a count's top (the counts add up to the total, which has its own). They stay in the
// schema for the API's document and for what it generates. The values a list may offer are read from the item's own
// lists, not from the facets' pattern.
import { describe, expect, it } from "@effect/vitest"
import { assertTrue } from "@effect/vitest/utils"
import { categories, maxCount, uoms } from "@inventory/catalog-contract/Item"
import { ItemFacets } from "@inventory/catalog-contract/ItemQuery"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as S from "effect/Schema"

const runs = { arbitrary: { runs: 200 } }

type Listed = ItemFacets["category"]
type Range = ItemFacets["unitCost"]
type ListName = "category" | "uom" | "isActive" | "lotTracked"
type RangeName = "quantityOnHand" | "unitCost"
const listNames: ReadonlyArray<ListName> = ["category", "uom", "isActive", "lotTracked"]
const rangeNames: ReadonlyArray<RangeName> = ["quantityOnHand", "unitCost"]

const accepted = S.is(ItemFacets)
// A value that is no category, no unit and no switch: what a list must never offer.
const offered = [...categories, ...uoms, "true", "false"]
const junkValue = Arbitrary.schema(
  S.String.check(S.makeFilter((text: string) => !A.contains(offered, text), { expected: "a value no item can have" }))
)
// The values each list may offer, read from the item's own lists.
const valuesOf: Readonly<Record<ListName, ReadonlyArray<string>>> = {
  category: categories,
  uom: uoms,
  isActive: ["true", "false"],
  lotTracked: ["true", "false"]
}
// Strictly between 0 and 1: what makes a whole number not whole.
const Fraction = S.Finite.check(S.isBetween({ minimum: 0.001, maximum: 0.999 }))
const noRange: Range = { min: O.none(), max: O.none() }

/**
 * The list with one value written twice and its counts still adding up: one entry renamed to another's value when
 * there are two, or one entry's count cut in two. None when the list has neither (fewer than two items in it).
 */
const doubled = (listed: Listed): O.Option<Listed> =>
  O.orElse(
    O.map(O.all([A.get(listed, 0), A.get(listed, 1)]), ([first, second]): Listed => [
      first,
      { value: first.value, count: second.count },
      ...A.drop(listed, 2)
    ]),
    () =>
      O.map(
        O.filter(A.head(listed), (first) => first.count >= 2),
        (first): Listed => [
          { value: first.value, count: 1 },
          { value: first.value, count: first.count - 1 }
        ]
      )
  )

describe("what the Items filters offer", () => {
  it.prop(
    "is refused when a list offers a value no item can have, the counts still adding up",
    [Arbitrary.schema(ItemFacets), junkValue],
    ([facets, junk]) => {
      for (const name of listNames) {
        A.matchLeft(facets[name], {
          onEmpty: () => undefined,
          onNonEmpty: (first, rest) =>
            expect(accepted({ ...facets, [name]: [{ value: junk, count: first.count }, ...rest] })).toBe(false)
        })
      }
    },
    runs
  )

  it.prop(
    "is refused when a list names a value no item has, with a count of 0",
    [Arbitrary.schema(ItemFacets)],
    ([facets]) => {
      for (const name of listNames) {
        const listed = facets[name]
        // A value the list may offer and does not: listed with no items, the counts still add up.
        const absent = A.findFirst(valuesOf[name], (value) => !A.some(listed, (entry) => entry.value === value))
        if (listed.length < valuesOf[name].length) {
          assertTrue(O.isSome(absent), "expected the tested value to be present")
          expect(accepted({ ...facets, [name]: [...listed, { value: absent.value, count: 0 }] })).toBe(false)
        }
      }
    },
    runs
  )

  it.prop(
    "is refused when a range's end is below zero, or a quantity is not whole",
    [Arbitrary.schema(ItemFacets), Arbitrary.schema(Fraction)],
    ([facets, fraction]) => {
      for (const name of rangeNames) {
        const { min, max } = facets[name]
        if (facets.total > 0) {
          assertTrue(O.isSome(min), "expected the tested value to be present")
          assertTrue(O.isSome(max), "expected the tested value to be present")
          expect(accepted({ ...facets, [name]: { min: O.some(-1 - min.value), max } })).toBe(false)
        }
      }
      const { min, max } = facets.quantityOnHand
      if (facets.total > 0) {
        assertTrue(O.isSome(min), "expected the tested value to be present")
        assertTrue(O.isSome(max), "expected the tested value to be present")
        if (min.value < max.value) {
          expect(accepted({ ...facets, quantityOnHand: { min: O.some(min.value + fraction), max } })).toBe(false)
        }
      }
    },
    runs
  )

  it.prop(
    "is refused when a range's top is past the most a stock number may be, or a unit cost past a trillion dollars",
    [Arbitrary.schema(ItemFacets), Arbitrary.schema(Fraction)],
    ([facets, fraction]) => {
      // The tops: a stock number at most `maxCount`; a cost has twelve dollar digits at most, so no range reaches past
      // a trillion dollars.
      const past: Readonly<Record<RangeName, number>> = { quantityOnHand: maxCount + 1, unitCost: 1e12 + fraction }
      for (const name of rangeNames) {
        const { min } = facets[name]
        if (facets.total > 0) {
          assertTrue(O.isSome(min), "expected the tested value to be present")
          expect(accepted({ ...facets, [name]: { min, max: O.some(past[name]) } })).toBe(false)
        }
      }
    },
    runs
  )

  it.prop(
    "is refused when it counts more items than a stock number may be, though every list adds up",
    [
      Arbitrary.schema(ItemFacets),
      Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: 40 }))),
      Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 1, maximum: maxCount - 1 }))),
      Arbitrary.schema(
        S.Tuple([
          S.Int.check(S.isBetween({ minimum: 0, maximum: maxCount })),
          S.Int.check(S.isBetween({ minimum: 0, maximum: maxCount }))
        ])
      ),
      Arbitrary.schema(
        S.Tuple([
          S.Finite.check(S.isBetween({ minimum: 0, maximum: 1e12 })),
          S.Finite.check(S.isBetween({ minimum: 0, maximum: 1e12 }))
        ])
      )
    ],
    ([facets, pick, cut, quantities, costs]) => {
      // Each list counts the items under two of its values, chosen by the draw, cut where the draw says: every count
      // stays within a stock number's bound, and each range runs from the lower drawn end to the higher.
      const rangeOver = (ends: ReadonlyArray<number>): Range => ({
        min: A.head(A.sort(ends, Order.Number)),
        max: A.last(A.sort(ends, Order.Number))
      })
      const counted = (total: number): ItemFacets => {
        const split = (values: ReadonlyArray<string>): Listed =>
          A.zipWith(
            A.take(A.appendAll(A.drop(values, pick % values.length), values), 2),
            [cut, total - cut],
            (value, count) => ({ value, count })
          )
        return {
          ...facets,
          total,
          category: split(valuesOf.category),
          uom: split(valuesOf.uom),
          isActive: split(valuesOf.isActive),
          lotTracked: split(valuesOf.lotTracked),
          quantityOnHand: rangeOver(quantities),
          unitCost: rangeOver(costs)
        }
      }
      expect(accepted(counted(maxCount))).toBe(true)
      expect(accepted(counted(maxCount + 1))).toBe(false)
    },
    runs
  )

  it.prop(
    "is refused when its total is not a whole number",
    [Arbitrary.schema(ItemFacets), Arbitrary.schema(Fraction)],
    ([facets, fraction]) => {
      expect(accepted({ ...facets, total: facets.total + fraction })).toBe(false)
    },
    runs
  )

  it.prop(
    "is refused when one list's counts do not add up to the items",
    [Arbitrary.schema(ItemFacets)],
    ([facets]) => {
      expect(accepted(facets)).toBe(true)
      expect(accepted({ ...facets, total: facets.total + 1 })).toBe(false)
      for (const name of listNames) {
        A.matchLeft(facets[name], {
          onEmpty: () => undefined,
          onNonEmpty: (first, rest) =>
            expect(accepted({ ...facets, [name]: [{ value: first.value, count: first.count + 1 }, ...rest] })).toBe(
              false
            )
        })
      }
    },
    runs
  )

  it.prop(
    "is refused when a list names one value twice, though its counts add up",
    [Arbitrary.schema(ItemFacets)],
    ([facets]) => {
      for (const name of listNames) {
        const twice = doubled(facets[name])
        if (facets.total >= 2) {
          assertTrue(O.isSome(twice), "expected the tested value to be present")
          expect(accepted({ ...facets, [name]: twice.value })).toBe(false)
        }
      }
    },
    runs
  )

  it.prop(
    "is refused when a range has one end and not the other",
    [Arbitrary.schema(ItemFacets)],
    ([facets]) => {
      for (const name of rangeNames) {
        const { min, max } = facets[name]
        if (facets.total > 0) {
          assertTrue(O.isSome(min), "expected the tested value to be present")
          assertTrue(O.isSome(max), "expected the tested value to be present")
          expect(accepted({ ...facets, [name]: { min, max: O.none() } })).toBe(false)
          expect(accepted({ ...facets, [name]: { min: O.none(), max } })).toBe(false)
        }
      }
    },
    runs
  )

  it.prop(
    "is refused when a range is upside down",
    [Arbitrary.schema(ItemFacets)],
    ([facets]) => {
      for (const name of rangeNames) {
        const { min, max } = facets[name]
        if (facets.total > 0) {
          assertTrue(O.isSome(min), "expected the tested value to be present")
          assertTrue(O.isSome(max), "expected the tested value to be present")
          if (min.value < max.value) {
            expect(accepted({ ...facets, [name]: { min: max, max: min } })).toBe(false)
          }
        }
      }
    },
    runs
  )

  it.prop(
    "with no items has no range, and a range there with no items is refused",
    [Arbitrary.schema(ItemFacets), Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: 1_000_000 })))],
    ([facets, end]) => {
      const none = {
        ...facets,
        total: 0,
        category: [],
        uom: [],
        isActive: [],
        lotTracked: [],
        quantityOnHand: noRange,
        unitCost: noRange
      }
      expect(accepted(none)).toBe(true)
      for (const name of rangeNames) {
        expect(accepted({ ...none, [name]: { min: O.some(end), max: O.some(end) } })).toBe(false)
      }
    },
    runs
  )

  it.prop(
    "with items has both ranges",
    [Arbitrary.schema(ItemFacets)],
    ([facets]) => {
      for (const name of rangeNames) {
        if (facets.total > 0) expect(accepted({ ...facets, [name]: noRange })).toBe(false)
      }
    },
    runs
  )
})
