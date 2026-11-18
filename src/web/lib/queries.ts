// How the browser caches what it fetched. The rules this file protects: data fetched a moment ago is shown as it is
// (a screen change or a remount does not ask the server again); the session is fetched once and never refetched on
// its own; a refusal is never retried; and every query key a write invalidates is named here, so a write invalidates
// exactly what it changed.
import { QueryClient } from "@tanstack/react-query"
import type { ItemQuery } from "../../domain/ItemQuery.ts"
import { isTransient } from "./errors.ts"

/**
 * Every query key, in one place. A write invalidates the keys of what it changed: a confirm changes the items,
 * the changed values, the activity and the open imports; an item edit changes the items, the imports that created
 * them (whether they can be taken back) and the activity.
 */
export const queryKeys = {
  /** Who is signed in and as whom (`useActor`): fetched once per page load, dropped on sign-in or a switch. */
  session: ["identity", "session"],
  members: ["identity", "members"],
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
  changes: ["changes"],
  activity: ["activity"],
  people: ["people"]
} as const

/** How long fetched data is shown as it is before a screen that mounts asks again. */
export const freshFor = 30_000

/**
 * The tab's one query client. Queries: fresh for `freshFor`, no refetch when the window regains focus, one more try
 * only for a failure that may pass (the network, a server error). Mutations are never retried by the client: a
 * button is disabled while its request is pending, and the server treats a repeated write as the same write.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: freshFor,
      refetchOnWindowFocus: false,
      retry: (failures, error) => failures < 1 && isTransient(error)
    },
    mutations: { retry: false }
  }
})

/** Options for the session's query: fetched once, then never again on its own (mount, focus, reconnect). */
export const sessionQuery = {
  staleTime: Infinity,
  gcTime: Infinity,
  refetchOnMount: false,
  refetchOnReconnect: false
} as const
