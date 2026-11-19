// An item row as SQLite stores it, and its reading into an item: shared by the two stores of this host.
import * as S from "effect/Schema"
import * as Struct from "effect/Struct"
import { StoredItem, Dimensions, Vendor, stockingOf } from "@inventory/catalog-contract/Item"
import * as SqlClient from "effect/sql/SqlClient"

/**
 * An item as SQLite stores it, decoded by the services that read `item` (here and `Items`): the two switches are 0 or
 * 1, and tags, dimensions and vendors are JSON text, each checked against its Schema on the way out as on the way in.
 * Whether it is in use is two columns here, `isActive` and `discontinuedOn`; `storedItem` reads them as one `stocking`.
 */
export const ItemRow = S.Struct({
  ...Struct.omit(StoredItem.fields, ["stocking"]),
  isActive: S.BooleanFromBit,
  discontinuedOn: S.OptionFromNullOr(S.String),
  lotTracked: S.BooleanFromBit,
  tags: S.String.pipe(S.Array, S.fromJsonString),
  dimensions: Dimensions.pipe(S.fromJsonString, S.OptionFromNullOr),
  vendors: Vendor.pipe(S.Array, S.fromJsonString)
}).annotate({ description: "An item row as SQLite stores it" })

/** The decoded value of `ItemRow`: an item's columns as SQLite stores them. */
export type ItemRow = typeof ItemRow.Type

/** The item a row holds: its two stocking columns read as one value (the table's CHECK refuses the impossible pair). */
export const storedItem = (row: ItemRow): StoredItem => {
  const { discontinuedOn, isActive, ...rest } = row
  return { ...rest, stocking: stockingOf({ isActive, discontinuedOn }) }
}

/** The columns of `item` that `ItemRow` reads, in one place for every query that answers items. */
export const itemColumns = (sql: SqlClient.SqlClient) =>
  sql`id, sku, name, description, category, uom, unitCost, quantityOnHand, reorderPoint, isActive, lotTracked, tags,
    firstReceivedOn, discontinuedOn, dimensions, vendors, createdAt, createdBy, revision`
