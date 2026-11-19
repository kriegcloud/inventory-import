// The access contract's identity composer. The vendored `@beep/identity` makes every root under `@beep`, so the
// identifiers read `@beep/inventory/access/contract/...` (decision "kernel identity").
import * as Id from "@beep/identity/Id"

/** Identity composer for `@inventory/access-contract`. */
export const $AccessContractId = Id.make("inventory")
  .$InventoryId.compose("access")
  .$AccessId.compose("contract").$ContractId
