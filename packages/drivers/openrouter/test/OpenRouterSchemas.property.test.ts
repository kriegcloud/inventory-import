// Every exported schema generates only values it accepts (schema-first rule SF-7).
import { describe, expect, it } from "@effect/vitest"
import * as Arbitrary from "effect/Arbitrary"
import * as Effect from "effect/Effect"
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
  OffReason,
  ReportedTokenCount,
  ReportedTokenTotals
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
  generatesOnlyValid("ReportedTokenCount", ReportedTokenCount)
  generatesOnlyValid("ReportedTokenTotals", ReportedTokenTotals)
  generatesOnlyValid("ModelUsage", ModelUsage)
  generatesOnlyValid("ModelAnswered", ModelAnswered)
  generatesOnlyValid("ModelPolicy", ModelPolicy)
  generatesOnlyValid("OpenRouterSettings", OpenRouterSettings)
})

describe("provider token totals", () => {
  it.effect("defaults missing, undefined and NULL totals while preserving zero and reported counts", () =>
    Effect.gen(function* () {
      const totals = yield* Effect.forEach(
        [
          {},
          { inputTokens: undefined, outputTokens: undefined },
          { inputTokens: null, outputTokens: null },
          { inputTokens: 0, outputTokens: 0 },
          { inputTokens: 12, outputTokens: 5 }
        ],
        (input) => S.decodeEffect(ReportedTokenTotals)(input),
        { concurrency: 1 }
      )
      expect(totals).toEqual([
        { inputTokens: 0, outputTokens: 0 },
        { inputTokens: 0, outputTokens: 0 },
        { inputTokens: 0, outputTokens: 0 },
        { inputTokens: 0, outputTokens: 0 },
        { inputTokens: 12, outputTokens: 5 }
      ])
    })
  )
})
