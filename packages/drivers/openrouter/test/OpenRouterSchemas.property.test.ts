// Every exported schema generates only values it accepts (schema-first rule SF-7).
import { describe, expect, it } from "@effect/vitest"
import * as Arbitrary from "effect/Arbitrary"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { ModelPolicy, OpenRouterSettings } from "@beep/openrouter/OpenRouterConfig"
import {
  ModelAccess,
  ModelAnswered,
  ModelId,
  ModelName,
  ModelPrompt,
  ModelStatus,
  ModelTrouble,
  ModelUsage,
  OffReason
} from "@beep/openrouter/OpenRouterModel"

const schemas = {
  ModelId,
  ModelName,
  OffReason,
  ModelAccess,
  ModelStatus,
  ModelTrouble,
  ModelPrompt,
  ModelUsage,
  ModelAnswered,
  ModelPolicy,
  OpenRouterSettings
}

describe("every schema generates only valid values", () => {
  for (const [name, schema] of R.toEntries(schemas)) {
    it.prop(
      name,
      [Arbitrary.schema(schema as S.Top)],
      ([value]) => {
        expect(S.is(schema as S.Top)(value)).toBe(true)
      },
      { arbitrary: { runs: 50 } }
    )
  }
})
