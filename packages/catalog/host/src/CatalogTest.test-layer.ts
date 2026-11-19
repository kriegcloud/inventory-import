// The catalog for tests, with no database: every port on its in-memory twin, and the state they share. This is the
// model's own `catalogMemory`, named here so a test of the app composes a context's test layer from its host, as it
// does for access. With no option there is no model and 40 calls a day.
import { Answerer } from "@inventory/catalog-model/Answerer"
import { catalogMemory, CatalogMemoryRef } from "@inventory/catalog-model/Memory"

/** The catalog's test layers. */
export const CatalogTest = {
  /** Every port in memory. Pass `answerer` for a scripted model, `calls` for what is left of the day's allowance. */
  memory: catalogMemory,
  /** The twins' shared state: what a test reads to see what a handler stored. */
  state: CatalogMemoryRef,
  /** A scripted model for `memory({ answerer })`. */
  scripted: Answerer.scripted
}
