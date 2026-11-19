// The access host's identity composer: identifiers read `@beep/inventory/access/host/...`.
import * as Id from "@beep/identity/Id"

/** Identity composer for `@inventory/access-host`. */
export const $AccessHostId = Id.make("inventory").$InventoryId.compose("access").$AccessId.compose("host").$HostId
