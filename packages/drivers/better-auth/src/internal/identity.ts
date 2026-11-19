// The package's identity composer. The vendored `@beep/identity/packages` has no `better-auth` entry, so it is composed
// here from the same root and yields the same `@beep/better-auth/...` identifiers it would.
import { $I } from "@beep/identity/packages"

/** Identity composer for `@beep/better-auth`. */
export const $BetterAuthId = $I.compose("better-auth").$BetterAuthId
