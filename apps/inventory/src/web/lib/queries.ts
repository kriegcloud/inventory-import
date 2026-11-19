// The app's query keys. The rule this file protects: every query key a write invalidates is named here (the access
// screens' own come from `@inventory/access-web`), so a write invalidates exactly what it changed. How fetched data is
// cached is `@inventory/client/QueryClient`'s.
import { accessKeys } from "@inventory/access-web/Access"
import { catalogKeys } from "@inventory/catalog-web/Keys"
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
  // Imports, items and the changed values: the catalog screens' own keys.
  ...catalogKeys,
  // After the catalog's, so the audit trail keeps the access screens' key under its name.
  activity: accessKeys.activity
} as const
