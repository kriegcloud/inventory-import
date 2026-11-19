// The package's identity composer. The vendored `@beep/identity/packages` has no `openrouter` entry, so it is composed
// here from the same root and yields the same `@beep/openrouter/...` identifiers it would.
import { $I } from "@beep/identity/packages"

/** Identity composer for `@beep/openrouter`. */
export const $OpenrouterId = $I.compose("openrouter").$OpenrouterId
