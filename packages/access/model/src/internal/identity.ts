// The access model's identity composer: identifiers read `@beep/inventory/access/model/...`.
import * as Id from "@beep/identity/Id"

/** Identity composer for `@inventory/access-model`. */
export const $AccessModelId = Id.make("inventory").$InventoryId.compose("access").$AccessId.compose("model").$ModelId
