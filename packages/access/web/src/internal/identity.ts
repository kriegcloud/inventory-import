// The access screens' identity composer: identifiers read `@beep/inventory/access/web/...`.
import * as Id from "@beep/identity/Id"

/** Identity composer for `@inventory/access-web`. */
export const $AccessWebId = Id.make("inventory").$InventoryId.compose("access").$AccessId.compose("web").$WebId
