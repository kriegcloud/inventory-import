// What the Items filters offer is counted over every item of the organization, and every item has a category, a unit,
// and both switches: so each list's counts add up to the items, a value no item has is left out, and a range is there
// exactly when there are items, lowest first. Facets are generated from the schema, then broken one rule at a time;
// each broken copy must be refused, so every rule of the check is seen to hold on its own.
import { describe, expect, it } from "@effect/vitest"
import { Category, Uom } from "@inventory/catalog-contract/Item"
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
    "offers only values an item can have",
    [Arbitrary.schema(ItemFacets)],
    ([facets]) => {
      expect(A.every(facets.category, (entry) => S.is(Category)(entry.value))).toBe(true)
      expect(A.every(facets.uom, (entry) => S.is(Uom)(entry.value))).toBe(true)
      for (const listed of [facets.isActive, facets.lotTracked]) {
        expect(A.every(listed, (entry) => entry.value === "true" || entry.value === "false")).toBe(true)
      }
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
