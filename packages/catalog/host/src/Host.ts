// The catalog on D1: its two stores, and the two features that may ask a model. One Layer for the app to compose;
// it needs the database, the model service and the access context's gateway to the day's allowance.
import { Layer } from "effect"
import { ImportStoreD1 } from "./ImportStore.adapter.ts"
import { ItemStoreD1 } from "./ItemStore.adapter.ts"
import { SuggestionsLive } from "./Suggestions.adapter.ts"
import { TableAssistantLive } from "./TableAssistant.adapter.ts"

/** Every port of the catalog, implemented: the stores on D1, suggestions and the table assistant on the model. */
export const CatalogLive = Layer.mergeAll(ImportStoreD1, ItemStoreD1, SuggestionsLive, TableAssistantLive)
