// The package's identity composer. beep-effect's `@beep/identity/packages` (vendored byte for byte) has no `xlsx`
// entry, so it is composed here from the same root and yields the same `@beep/xlsx/...` identifiers it would.
// It moves into `packages.ts` when `@beep/xlsx` is promoted to beep-effect.
import { $I } from "@beep/identity/packages"

/** Identity composer for `@beep/xlsx`. */
export const $XlsxId = $I.compose("xlsx").$XlsxId
