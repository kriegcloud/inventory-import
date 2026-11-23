import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as BigDecimal from "effect/BigDecimal"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as S from "effect/Schema"
import * as SchemaGetter from "effect/SchemaGetter"
import { categories, Category, maxCount, StoredItem, UnitCost, Uom, uoms } from "./Item.read.ts"
import { ItemSearchText } from "./ItemSearch.read.ts"
import { nullAsNone } from "@inventory/kernel/Wire"

// ONE QUESTION ABOUT THE ITEMS: which page, in what order, and narrowed how. The table on the Items page asks
// it and the server answers it in SQL, so a list of 50,000 items is never sent to the browser to be sorted there. The
// shape is the data table kit's own query (page, page size, sorting, filters, how the filters join), so what the
// table holds is what the server reads.
//
// The one thing not to break: a column is named only by an id from the lists below. The server turns an id into a
// column through a fixed table and a value into a bound parameter; nothing the browser sends is ever SQL.

/** The columns the Items table can be sorted by, by the id the table gives each. */
export const itemSortColumns = [
  "name",
  "sku",
  "category",
  "uom",
  "unitCost",
  "quantityOnHand",
  "reorderPoint",
  "firstReceivedOn",
  "createdAt"
] as const
/** A column the Items table can be sorted by. */
export const ItemSortColumn = LiteralKit(itemSortColumns).annotate({
  description: "A column the Items table can be sorted by"
})
/** The decoded value of `ItemSortColumn`: a column the Items table can be sorted by. */
export type ItemSortColumn = typeof ItemSortColumn.Type

/**
 * How each column that can be filtered is compared: `text` is searched, `select` is one of a fixed list, and
 * `number` is a number as the person types it; a unit cost is typed in dollars ("12.50"). Active and Lot tracked are
 * a select of two values, "true" and "false", which the screen words Yes and No.
 */
export const itemFilterVariants = {
  name: "text",
  sku: "text",
  description: "text",
  category: "select",
  uom: "select",
  isActive: "select",
  lotTracked: "select",
  quantityOnHand: "number",
  unitCost: "number"
} as const
/** A column the Items table can be filtered by. */
export const ItemFilterColumn = LiteralKit([
  "name",
  "sku",
  "description",
  "category",
  "uom",
  "isActive",
  "lotTracked",
  "quantityOnHand",
  "unitCost"
]).annotate({
  description: "A column the Items table can be filtered by"
})
/** The decoded value of `ItemFilterColumn`: a column the Items table can be filtered by. */
export type ItemFilterColumn = typeof ItemFilterColumn.Type

/** The comparisons the data table kit can ask for. Which of them a column honours depends on its variant. */
export const FilterOperator = LiteralKit([
  "iLike",
  "notILike",
  "eq",
  "ne",
  "inArray",
  "notInArray",
  "isEmpty",
  "isNotEmpty",
  "lt",
  "lte",
  "gt",
  "gte",
  "isBetween"
]).annotate({ description: "The comparisons the data table kit can ask for" })
/** The decoded value of `FilterOperator`: the comparisons the data table kit can ask for. */
export type FilterOperator = typeof FilterOperator.Type

/** What kind of value a filter carries, as the data table kit names it. */
export const FilterVariant = LiteralKit(["text", "number", "date", "boolean", "select"]).annotate({
  description: "What kind of value a filter carries, as the data table kit names it"
})
/** The decoded value of `FilterVariant`: what kind of value a filter carries, as the data table kit names it. */
export type FilterVariant = typeof FilterVariant.Type

/** The variants the Items table's own columns have (`itemFilterVariants`): it has no date and no boolean column. */
export const ItemFilterVariant = FilterVariant.pick(["text", "select", "number"]).annotate({
  description: "How a column of the Items table is compared: searched text, one of a list, or a number"
})
/** The decoded value of `ItemFilterVariant`. */
export type ItemFilterVariant = typeof ItemFilterVariant.Type

const FilterText = S.String.check(S.isMaxLength(200))

/** One column of the order: its id, and whether it runs from high to low. */
export const ItemSort = S.Struct({
  id: ItemSortColumn,
  desc: S.Boolean.annotateKey({ description: "True: from high to low, Z to A" })
}).annotate({
  identifier: "ItemSort",
  description: "One column of the order: its id, and whether it runs from high to low"
})
/** The decoded value of `ItemSort`: one column of the order. */
export type ItemSort = typeof ItemSort.Type

/**
 * One filter as the data table kit holds it. `value` is one text, or a list for "any of these" and for a range
 * (two entries, either of which may be empty for an open end). A filter whose operator does not suit its column is
 * ignored, never an error: the table can hold a half-typed filter.
 */
export const ItemFilter = S.Struct({
  id: ItemFilterColumn,
  value: S.Union([FilterText, S.Array(FilterText).check(S.isMaxLength(50))]).annotateKey({
    description: "One text, or a list: any of these, or the two ends of a range (either may be empty for an open end)"
  }),
  variant: FilterVariant,
  operator: FilterOperator,
  filterId: S.optional(S.String.check(S.isMaxLength(64))).annotateKey({
    description: "The table's own name for this filter. The server does not read it"
  })
}).annotate({ identifier: "ItemFilter", description: "One filter as the data table kit holds it" })
/** The decoded value of `ItemFilter`: one filter as the data table kit holds it. */
export type ItemFilter = typeof ItemFilter.Type

/** The page sizes the table offers. The largest is the most rows one answer carries. */
export const itemPageSizes = [10, 20, 30, 40, 50] as const

/** Which page of the items, in what order, narrowed how. */
export const ItemQuery = S.Struct({
  page: S.Int.check(S.isBetween({ minimum: 1, maximum: 100000 })).annotateKey({
    description: "Counted from 1"
  }),
  perPage: S.Int.check(S.isBetween({ minimum: 1, maximum: 50 })),
  sorting: S.Array(ItemSort).check(S.isMaxLength(5)).annotate({
    description: "First entry first. Empty means by SKU, as the full list is, or best match first while searching"
  }),
  filters: S.Array(ItemFilter).check(S.isMaxLength(20)),
  joinOperator: S.Literals(["and", "or"]).annotateKey({
    description: "Whether a row must pass every filter or any one of them"
  }),
  search: ItemSearchText.annotateKey({
    description:
      "Words every item shown must hold in its name, SKU or description, in any order, whatever the filters' join. With no order chosen, the best matches come first"
  })
}).annotate({ description: "Which page of the items, in what order, narrowed how" })
/** The decoded value of `ItemQuery`: which page of the items, in what order, narrowed how. */
export type ItemQuery = typeof ItemQuery.Type

/** One page of items, and how many pages and items the same filters give in all. */
export const ItemPage = S.Struct({
  data: S.Array(StoredItem).annotateKey({ description: "The items on this page, in the order asked for" }),
  pageCount: S.Int.annotateKey({ description: "How many pages the same filters give at this page size" }),
  total: S.Int.annotateKey({ description: "Items that pass the filters, on every page together" })
}).annotate({
  identifier: "ItemPage",
  description: "One page of items, and how many pages and items the same filters give in all"
})
/** The decoded value of `ItemPage`: one page of items, and how many pages and items the same filters give in all. */
export type ItemPage = typeof ItemPage.Type

// One value a facet offers: only a value an item can have. The type stays text, the form the host reads from SQL;
// the check holds it to the list, and generates from it.
const facetValue = (values: ReadonlyArray<string>, description: string) =>
  S.String.check(S.isPattern(new RegExp(`^(${A.join(values, "|")})$`))).annotateKey({ description })

// How many items have a value: one at least, since a value no item has is left out.
const itemCount = S.Int.check(S.isBetween({ minimum: 1, maximum: maxCount })).annotateKey({
  description: "How many items have it: one at least, since a value no item has is left out"
})

const facetCounts = (values: ReadonlyArray<string>, description: string) =>
  S.Array(
    S.Struct({ value: facetValue(values, "The value as stored"), count: itemCount }).annotate({
      description: "One value in use, and how many items have it"
    })
  )
    .check(S.isMaxLength(values.length))
    .annotateKey({ description })

const switchValues = ["true", "false"] as const

// The ends of a range: both there when the organization has items, both null when it has none.
const range = <End extends S.Top>(end: End, description: string) =>
  S.Struct({
    min: end.pipe(nullAsNone({ description: "The lowest value; null when no item has one" })),
    max: end.pipe(nullAsNone({ description: "The highest value; null when no item has one" }))
  }).annotateKey({ description })

// A unit cost as the host's range reads it: dollars as a number, never below zero, no higher than a cost can be.
const costEnd = S.Finite.check(S.isBetween({ minimum: 0, maximum: 1_000_000_000_000 }))
const quantityEnd = S.Int.check(S.isBetween({ minimum: 0, maximum: maxCount }))

const ItemFacetsWire = S.Struct({
  total: S.Int.check(S.isBetween({ minimum: 0, maximum: maxCount })).annotateKey({
    description: "How many items the organization has, unfiltered"
  }),
  category: facetCounts(categories, "Each category in use, and how many items have it"),
  uom: facetCounts(uoms, "Each unit of measure in use, and how many items have it"),
  isActive: facetCounts(
    switchValues,
    'How many items are active ("true") and how many are not ("false"); a value no item has is left out'
  ),
  lotTracked: facetCounts(
    switchValues,
    'How many items are lot tracked ("true") and how many are not ("false"); a value no item has is left out'
  ),
  quantityOnHand: range(quantityEnd, "The lowest and highest quantity on hand; null with no items"),
  unitCost: range(costEnd, "The lowest and highest unit cost, in dollars; null with no items")
})
type ItemFacetsShape = typeof ItemFacetsWire.Type
type Listed = ItemFacetsShape["category"]
type Range = ItemFacetsShape["unitCost"]

const isFacetsWire = S.is(ItemFacetsWire)

/** True when the list counts every one of `total` items once, each value once. */
const countsAll = (listed: Listed, total: number): boolean =>
  A.reduce(listed, 0, (n, entry) => n + entry.count) === total &&
  A.dedupe(A.map(listed, (entry) => entry.value)).length === listed.length

/** True when the range has both ends exactly when there are items, the lowest first. */
const spans = (ends: Range, total: number): boolean =>
  O.isSome(ends.min) && O.isSome(ends.max)
    ? total > 0 && ends.min.value <= ends.max.value
    : O.isNone(ends.min) && O.isNone(ends.max) && total === 0

/** True when the facets are what some list of items would give: every count adds up, every range in order. */
const describesItems = (facets: ItemFacetsShape): boolean =>
  countsAll(facets.category, facets.total) &&
  countsAll(facets.uom, facets.total) &&
  countsAll(facets.isActive, facets.total) &&
  countsAll(facets.lotTracked, facets.total) &&
  spans(facets.quantityOnHand, facets.total) &&
  spans(facets.unitCost, facets.total)

// What generated facets are counted from: the items themselves, as the host counts them in SQL.
const FacetItems = S.Array(
  S.Struct({
    category: Category,
    uom: Uom,
    isActive: S.Boolean,
    lotTracked: S.Boolean,
    quantityOnHand: quantityEnd,
    unitCost: UnitCost
  })
)
type FacetItem = (typeof FacetItems.Type)[number]

const countsOf = (items: ReadonlyArray<FacetItem>, valueOf: (item: FacetItem) => string): Listed =>
  A.map(A.dedupe(A.map(items, valueOf)), (value) => ({
    value,
    count: A.filter(items, (item) => valueOf(item) === value).length
  }))

const rangeOf = (ends: ReadonlyArray<number>): Range => {
  const sorted = A.sort(ends, Order.Number)
  return { min: A.head(sorted), max: A.last(sorted) }
}

const facetsOf = (items: ReadonlyArray<FacetItem>): ItemFacetsShape => ({
  total: items.length,
  category: countsOf(items, (item) => item.category),
  uom: countsOf(items, (item) => item.uom),
  isActive: countsOf(items, (item) => `${item.isActive}`),
  lotTracked: countsOf(items, (item) => `${item.lotTracked}`),
  quantityOnHand: rangeOf(A.map(items, (item) => item.quantityOnHand)),
  unitCost: rangeOf(A.map(items, (item) => BigDecimal.toNumberUnsafe(item.unitCost)))
})

const CountedFacets = S.declare(
  (input: unknown): input is ItemFacetsShape => isFacetsWire(input) && describesItems(input),
  {
    identifier: "CountedFacets",
    description: "Facets whose every list counts each item once and whose ranges are there exactly when items are",
    expected:
      "facets whose lists each add up to the total, and whose ranges have both ends, lowest first, when there are items",
    // Arbitrary facets are counted from arbitrary items, as the host counts its own: they always describe items.
    toCodecArbitrary: () =>
      S.link<ItemFacetsShape>()(FacetItems, {
        decode: SchemaGetter.transform(facetsOf),
        encode: SchemaGetter.forbiddenEncoding
      })
  }
)

/**
 * What the filters can offer for this organization's items: each category and unit of measure in use with how many
 * items have it, and the lowest and highest quantity on hand and unit cost (dollars). Counted over all the items, not
 * the filtered ones. Every item has a category, a unit and both switches, so each list adds up to `total`; and a range
 * has both ends exactly when there are items. Facets that say otherwise are refused.
 */
export const ItemFacets = ItemFacetsWire.pipe(S.decodeTo(CountedFacets)).annotate({
  identifier: "ItemFacets",
  description:
    "What the filters can offer for this organization's items: each category and unit in use with how many items have it, and the lowest and highest quantity on hand and unit cost"
})
/** The decoded value of `ItemFacets`: what the filters can offer for this organization's items. */
export type ItemFacets = typeof ItemFacets.Type
