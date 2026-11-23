// The Items page's one read of what its filters offer, kept beside the page (`ItemsPage.screen.tsx`) and not in it,
// so the page's file exports components only and keeps what the person typed across an edit. The columns, the two
// toolbar filters and the assistant all read their values from this one read.
import { catalogKeys } from "./Catalog.keys.ts"
import { catalogApi } from "./Catalog.runtime.ts"

/** What the filters offer (each column's values, the range of numbers) and how many items there are in all. */
export const itemFacets = catalogApi.query((api) => api.items.facets(), { reactivityKeys: catalogKeys.itemFacets })
