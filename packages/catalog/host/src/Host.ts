// The catalog on Cloudflare: its stores on D1, the model service as the catalog asks it, and the day's allowance
// through the usage context. One Layer for the app to compose; it needs the database, the model service and the
// usage context's gateway.
import * as Layer from "effect/Layer"
import { ImportStoreD1 } from "./ImportStore.adapter.ts"
import { ItemStoreD1 } from "./ItemStore.adapter.ts"
import { SuggestionStoreD1 } from "./SuggestionStore.adapter.ts"
import { AssistantLogD1 } from "./AssistantLog.adapter.ts"
import { AnswererOpenRouter } from "./Answerer.adapter.ts"
import { ModelAllowanceViaUsage } from "./ModelAllowance.adapter.ts"

/** Every port of the catalog, implemented. */
export const CatalogLive = Layer.mergeAll(
  ImportStoreD1,
  ItemStoreD1,
  SuggestionStoreD1,
  AssistantLogD1,
  AnswererOpenRouter,
  ModelAllowanceViaUsage
)
