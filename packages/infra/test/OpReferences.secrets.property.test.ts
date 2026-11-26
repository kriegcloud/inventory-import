import { expect, it } from "@effect/vitest"
import * as Arbitrary from "effect/Arbitrary"
import * as S from "effect/Schema"
import { SecretReferencesError } from "@beep/infra/OpReferencesSecrets"

it.prop("SecretReferencesError generates only valid values", [Arbitrary.schema(SecretReferencesError)], ([error]) => {
  expect(S.is(SecretReferencesError)(error)).toBe(true)
})
