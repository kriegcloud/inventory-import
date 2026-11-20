// The items an organization has, as its endpoints answer for them: the organization is always the actor's, never one
// named in the request.
import * as Effect from "effect/Effect"
import { ImportStore } from "../Import/ImportStore.store.ts"
import { EditOutcome, ItemStore } from "./ItemStore.store.ts"
import { CurrentActor, requireRole } from "@inventory/kernel/Actor"
import { ItemQueryParams, ItemChanged, ItemNotFound } from "@inventory/catalog-contract/Catalog"
import { ItemId } from "@inventory/catalog-contract/Ids"
import { ItemEdit } from "@inventory/catalog-contract/Item"

/**
 * What each endpoint of the items group does. Any member may read them, and only their own organization's: the
 * organization is always the actor's, never one named in the request.
 */
export const itemsEndpoints = Effect.gen(function* () {
  const imports = yield* ImportStore
  const items = yield* ItemStore
  return {
    list: Effect.fn("items.list")(function* () {
      const actor = yield* CurrentActor
      return yield* imports.items(actor.organizationId)
    }),
    page: Effect.fn("items.page")(function* ({ query }: { readonly query: ItemQueryParams }) {
      const actor = yield* CurrentActor
      return yield* items.page(actor.organizationId, {
        page: query.page,
        perPage: query.perPage,
        sorting: query.sort,
        filters: query.filters,
        joinOperator: query.joinOperator,
        search: query.search
      })
    }),
    facets: Effect.fn("items.facets")(function* () {
      const actor = yield* CurrentActor
      return yield* items.facets(actor.organizationId)
    }),
    // A person's change to one item. The same edit sent twice answers the item and writes nothing the second time.
    edit: Effect.fn("items.edit")(function* ({
      params,
      payload
    }: {
      readonly params: { readonly id: ItemId }
      readonly payload: ItemEdit
    }) {
      const actor = yield* requireRole("editor")
      const done = yield* items.edit(actor, params.id, payload)
      return yield* EditOutcome.match(done, {
        Edited: ({ item }) => Effect.succeed(item),
        Same: ({ item }) => Effect.succeed(item),
        Changed: ({ item }) =>
          Effect.fail(
            ItemChanged.make({
              reason: `Someone changed ${item.sku} while you were editing it. Here is the item as it is now: make your change again.`,
              item
            })
          ),
        Missing: () =>
          Effect.fail(
            ItemNotFound.make({
              reason: "This item is not in your organization any more: the import that created it was taken back."
            })
          )
      })
    })
  }
})
