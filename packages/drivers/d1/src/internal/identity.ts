// The package's identity composer. The vendored `@beep/identity/packages` has no `d1` entry, so it is composed here
// from the same root and yields the same `@beep/d1/...` identifiers it would.
import { $I } from "@beep/identity/packages"

/** Identity composer for `@beep/d1`. */
export const $D1Id = $I.compose("d1").$D1Id
