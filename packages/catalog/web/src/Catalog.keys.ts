// The query keys of the catalog screens. The rule this file protects: every key a catalog write makes stale is named
// here, so a write invalidates exactly what it changed.
import { ItemQuery } from "@inventory/catalog-contract/ItemQuery"

/**
 * The keys the catalog screens cache under. A confirm changes the items, the changed values, the activity and the
 * open imports; an item edit changes the items, the imports that created them (whether they can be taken back) and
 * the activity.
 */
export const catalogKeys = {
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
  /**
   * The audit trail, which is the access screens' to show: named here by its key because a confirm, a take-back and
   * an edit each write a line to it, so each makes it stale.
   */
  activity: ["activity"]
} as const

/** The keys under the name the screens that moved here call them by. */
export const queryKeys = catalogKeys
