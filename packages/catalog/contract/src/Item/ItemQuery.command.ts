import * as S from "effect/Schema"
import { StoredItem } from "./Item.read.ts"
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
export const ItemSortColumn = S.Literals(itemSortColumns).annotate({
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
export const ItemFilterColumn = S.Literals([
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
export const FilterOperator = S.Literals([
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
export const FilterVariant = S.Literals(["text", "number", "date", "boolean", "select"]).annotate({
  description: "What kind of value a filter carries, as the data table kit names it"
})
/** The decoded value of `FilterVariant`: what kind of value a filter carries, as the data table kit names it. */
export type FilterVariant = typeof FilterVariant.Type

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

const Count = S.Struct({
  value: S.String.annotateKey({ description: "The value as stored" }),
  count: S.Int.annotateKey({ description: "How many items have it" })
}).annotate({ description: "One value in use, and how many items have it" })
const Range = S.Struct({
  min: S.Finite.pipe(nullAsNone({ description: "The lowest value; null when no item has one" })),
  max: S.Finite.pipe(nullAsNone({ description: "The highest value; null when no item has one" }))
}).annotate({ description: "The lowest and highest value; null when no item has one" })

/**
 * What the filters can offer for this organization's items: each category and unit of measure in use with how many
 * items have it, and the lowest and highest quantity on hand and unit cost (dollars). Counted over all the items, not
 * the filtered ones.
 */
export const ItemFacets = S.Struct({
  total: S.Int.annotateKey({ description: "How many items the organization has, unfiltered" }),
  category: S.Array(Count).annotateKey({ description: "Each category in use, and how many items have it" }),
  uom: S.Array(Count).annotateKey({ description: "Each unit of measure in use, and how many items have it" }),
  isActive: S.Array(Count).annotateKey({
    description: 'How many items are active ("true") and how many are not ("false"); a value no item has is left out'
  }),
  lotTracked: S.Array(Count).annotateKey({
    description:
      'How many items are lot tracked ("true") and how many are not ("false"); a value no item has is left out'
  }),
  quantityOnHand: Range.annotateKey({ description: "The lowest and highest quantity on hand; null with no items" }),
  unitCost: Range.annotateKey({ description: "The lowest and highest unit cost, in dollars; null with no items" })
}).annotate({
  identifier: "ItemFacets",
  description:
    "What the filters can offer for this organization's items: each category and unit in use with how many items have it, and the lowest and highest quantity on hand and unit cost"
})
/** The decoded value of `ItemFacets`: what the filters can offer for this organization's items. */
export type ItemFacets = typeof ItemFacets.Type
