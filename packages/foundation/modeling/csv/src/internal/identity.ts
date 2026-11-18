// The package's identity composer. beep-effect's `@beep/identity/packages` (vendored byte for byte) has no `csv`
// entry, so it is composed here from the same root and yields the same `@beep/csv/...` identifiers it would.
// It moves into `packages.ts` when `@beep/csv` is promoted to beep-effect.
import { $I } from "@beep/identity/packages"

/** Identity composer for `@beep/csv`. */
export const $CsvId = $I.compose("csv").$CsvId
