// The app's query keys. The rule this file protects: every query key a write invalidates is named here (the access
// screens' own come from `@inventory/access-web`), so a write invalidates exactly what it changed. How fetched data is
// cached is `@inventory/client/QueryClient`'s.
import { accessKeys } from "@inventory/access-web/Access"
import type { ItemQuery } from "../../domain/ItemQuery.ts"

export { freshFor, queryClient } from "@inventory/client/QueryClient"
export { sessionQuery } from "@inventory/access-web/Session"

/**
 * Every query key, in one place. A write invalidates the keys of what it changed: a confirm changes the items,
 * the changed values, the activity and the open imports; an item edit changes the items, the imports that created
 * them (whether they can be taken back) and the activity.
 */
export const queryKeys = {
  // Who is signed in, the members, the people and the audit trail: the access screens' own keys.
  ...accessKeys,
  status: ["system", "status"],
  /** The imports nobody has confirmed yet. Staging, confirming, taking back or removing a file makes it stale. */
  openImports: ["imports-open"],
  /** The imports confirmed at least once. Confirming, reopening or taking back an import makes it stale. */
  pastImports: ["imports-past"],
  /** Every import's view: the prefix an item edit invalidates. */
  imports: ["import"],
  /** One import as the server has it now. */
  import: (id: string | undefined) => ["import", id] as const,
  /** One staged file's rows: they never change, so they are kept for the page's life. */
  importTable: (id: string | undefined) => ["import-table", id] as const,
  /** Everything about items: the prefix a confirm, a take-back or an edit invalidates. */
  items: ["items"],
  /** Every page of items the table has fetched: the prefix an item edit changes at once. */
  itemsPages: ["items", "page"],
  itemsPage: (query: ItemQuery) => ["items", "page", query] as const,
  itemFacets: ["items", "facets"],
  /** The values imports wrote that differ from their files. */
  changes: ["changes"]
} as const
