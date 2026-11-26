// What the catalog keeps about items, as its handlers ask for it: a page of them sorted and filtered where they are
// stored, the facets, and the one edit a person makes by hand. The D1 adapter is in `catalog-host`.
import { StoredItem, ItemEdit } from "@inventory/catalog-contract/Item"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { OrganizationId } from "@inventory/kernel/Ids"
import { ItemQuery, ItemPage, ItemFacets } from "@inventory/catalog-contract/ItemQuery"
import { Member } from "@inventory/kernel/Member"

/**
 * What an edit did: changed the item (`Edited`), found it already as asked (`Same`: the same edit sent again, which
 * writes nothing), found someone else's change in between (`Changed`, with the item as it is now), or found none.
 */
export const EditOutcome = S.TaggedUnion({
  Edited: { item: StoredItem },
  Same: { item: StoredItem },
  Changed: { item: StoredItem },
  Missing: {}
}).annotate({
  description: "What an edit did: changed the item, found it as asked, found another change, or found none"
})
/** The decoded value of `EditOutcome`. Branch with `EditOutcome.match`. */
export type EditOutcome = typeof EditOutcome.Type

/**
 * Reads of the items for the Items table, a page at a time, sorted and filtered by the database, so a list
 * of 50,000 items is never sent to the browser to be sorted there; and the one change a person makes to an item
 * by hand. Every method takes the organization explicitly. A filter the table holds half-typed (an operator that does
 * not suit its column, a value of the wrong shape) is left out, never an error.
 */
export class ItemStore extends Context.Service<
  ItemStore,
  {
    /**
     * One page of the organization's items that hold every search word and pass the filters, and how many pages
     * and items they make in all. With a search and no order chosen, the items with the most words in their name
     * come first, then in their SKU, then by SKU.
     */
    readonly page: {
      (organizationId: OrganizationId): (self: ItemQuery) => Effect.Effect<ItemPage>
      (self: ItemQuery, organizationId: OrganizationId): Effect.Effect<ItemPage>
    }
    /** Each category and unit in use with its count, and the lowest and highest quantity on hand and unit cost. */
    facets(organizationId: OrganizationId): Effect.Effect<ItemFacets>
    /**
     * Changes one item to the values given, if it is still at the revision the person saw, with the audit line, in
     * one batch. The revision goes up, so the import that created the item can no longer take it back. Sending the
     * same edit again writes nothing.
     */
    readonly edit: {
      (actor: Member, edit: ItemEdit): (self: string) => Effect.Effect<EditOutcome>
      (self: string, actor: Member, edit: ItemEdit): Effect.Effect<EditOutcome>
    }
  }
>()("@inventory/catalog-model/Item/ItemStore.store/ItemStore") {}
