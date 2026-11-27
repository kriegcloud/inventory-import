// The usage contract's identity composer. The vendored `@beep/identity` makes every root under `@beep`, so the
// identifiers read `@beep/inventory/usage/contract/...` (decision "kernel identity").
import * as Id from "@beep/identity/Id"

/** Identity composer for `@inventory/usage-contract`. */
export const $UsageContractId = Id.make("inventory")
  .$InventoryId.compose("usage")
  .$UsageId.compose("contract").$ContractId
