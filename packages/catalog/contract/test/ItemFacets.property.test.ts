// What the Items filters offer is counted over every item of the organization, and every item has a category, a unit,
// and both switches: so each list's counts add up to the items, a value no item has is left out, and a range is there
// exactly when there are items, lowest first. Facets are generated from the schema, then broken one rule at a time;
// each broken copy must be refused, so every rule of the check is seen to hold on its own. The values a list may offer
// are read from the item's own lists, not from the facets' pattern.
import { describe, expect, it } from "@effect/vitest"
import { categories, uoms } from "@inventory/catalog-contract/Item"
import { ItemFacets } from "@inventory/catalog-contract/ItemQuery"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as O from "effect/Option"
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
const doubled = (listed: Listed): O.Option<Listed> => {
  const [first, second, ...rest] = listed
  if (first !== undefined && second !== undefined) {
    return O.some([first, { value: first.value, count: second.count }, ...rest])
  }
  if (first !== undefined && first.count >= 2) {
    return O.some([
      { value: first.value, count: 1 },
      { value: first.value, count: first.count - 1 }
    ])
  }
  return O.none()
}

describe("what the Items filters offer", () => {
  it.prop(
    "is refused when a list offers a value no item can have, the counts still adding up",
    [Arbitrary.schema(ItemFacets), junkValue],
    ([facets, junk]) => {
      for (const name of listNames) {
        const [first, ...rest] = facets[name]
        if (first !== undefined) {
          expect(accepted({ ...facets, [name]: [{ value: junk, count: first.count }, ...rest] })).toBe(false)
        }
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
        if (O.isSome(absent)) {
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
        if (O.isSome(min) && O.isSome(max)) {
          expect(accepted({ ...facets, [name]: { min: O.some(-1 - min.value), max } })).toBe(false)
        }
      }
      const { min, max } = facets.quantityOnHand
      if (O.isSome(min) && O.isSome(max) && min.value < max.value) {
        expect(accepted({ ...facets, quantityOnHand: { min: O.some(min.value + fraction), max } })).toBe(false)
      }
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
        const [first, ...rest] = facets[name]
        if (first !== undefined) {
          expect(accepted({ ...facets, [name]: [{ value: first.value, count: first.count + 1 }, ...rest] })).toBe(false)
        }
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
        if (O.isSome(twice)) expect(accepted({ ...facets, [name]: twice.value })).toBe(false)
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
        if (O.isSome(min)) expect(accepted({ ...facets, [name]: { min, max: O.none() } })).toBe(false)
        if (O.isSome(max)) expect(accepted({ ...facets, [name]: { min: O.none(), max } })).toBe(false)
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
        if (O.isSome(min) && O.isSome(max) && min.value < max.value) {
          expect(accepted({ ...facets, [name]: { min: max, max: min } })).toBe(false)
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
