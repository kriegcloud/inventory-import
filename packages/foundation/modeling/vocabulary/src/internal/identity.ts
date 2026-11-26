// The package's identity composer. beep-effect's `@beep/identity/packages` (vendored byte for byte) has no
// `vocabulary` entry, so it is composed here from the same root and yields the same `@beep/vocabulary/...`
// identifiers it would. It moves into `packages.ts` if `@beep/vocabulary` is promoted to beep-effect.
import { $I } from "@beep/identity/packages"

/** Identity composer for `@beep/vocabulary`. */
export const $VocabularyId = $I.compose("vocabulary").$VocabularyId
