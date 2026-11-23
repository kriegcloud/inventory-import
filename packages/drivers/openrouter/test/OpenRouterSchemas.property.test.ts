// Every exported schema generates only values it accepts (schema-first rule SF-7).
import { describe, expect, it } from "@effect/vitest"
import * as Arbitrary from "effect/Arbitrary"
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

const runs = { arbitrary: { runs: 50 } }

/** `schema` generates only values it accepts. */
const generatesOnlyValid = <Schema extends S.Top>(name: string, schema: Schema) =>
  it.prop(
    name,
    [Arbitrary.schema(schema)],
    ([value]) => {
      expect(S.is(schema)(value)).toBe(true)
    },
    runs
  )

describe("every schema generates only valid values", () => {
  generatesOnlyValid("ModelId", ModelId)
  generatesOnlyValid("ModelName", ModelName)
  generatesOnlyValid("OffReason", OffReason)
  generatesOnlyValid("ModelAccess", ModelAccess)
  generatesOnlyValid("ModelStatus", ModelStatus)
  generatesOnlyValid("ModelTrouble", ModelTrouble)
  generatesOnlyValid("ModelPrompt", ModelPrompt)
  generatesOnlyValid("ModelUsage", ModelUsage)
  generatesOnlyValid("ModelAnswered", ModelAnswered)
  generatesOnlyValid("ModelPolicy", ModelPolicy)
  generatesOnlyValid("OpenRouterSettings", OpenRouterSettings)
})
