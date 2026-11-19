// The package's identity composer. The vendored `@beep/identity` makes every root under `@beep`, so the identifiers
// read `@beep/inventory/review/...`, as the kernel's read `@beep/inventory/kernel/...` (decision "kernel identity").
import * as Id from "@beep/identity/Id"

/** Identity composer for `@inventory/review`. */
export const $ReviewId = Id.make("inventory").$InventoryId.compose("review").$ReviewId
