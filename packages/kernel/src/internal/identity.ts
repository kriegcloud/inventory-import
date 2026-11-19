// The kernel's identity composer. The vendored `@beep/identity` makes every root under `@beep`, and refuses an
// `@inventory/...` base, so the kernel's identifiers read `@beep/inventory/kernel/...` (decision "kernel identity").
// Switch this one line when the kit gains a second root upstream.
import * as Id from "@beep/identity/Id"

/** Identity composer for `@inventory/kernel`. */
export const $KernelId = Id.make("inventory").$InventoryId.compose("kernel").$KernelId
