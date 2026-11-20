// Who answered a result a model may have helped with, in words for the screen. The sentences are the contract's
// (`packages/catalog/contract/src/Answer/AiUnavailable.rejection.ts`), so the server words its `AiUnavailable` with the same ones.
import * as Match from "effect/Match"
import type { AnsweredBy } from "@inventory/catalog-contract/Answer"
import { type ModelTrouble, modelSentences } from "@inventory/catalog-contract/AiUnavailable"
/**
 * Why a model did not answer, in five words the screen knows (`ModelTrouble`), and the five sentences
 * (`modelSentences`). Both are the contract's (`packages/catalog/contract/src/Answer/AiUnavailable.rejection.ts`), so the server words its `AiUnavailable`
 * with the same sentences; the provider's own words stay in the server's log.
 */
export { type ModelTrouble, modelSentences }

const providerName = (provider: string): string => (provider === "openrouter" ? "OpenRouter" : provider)

/**
 * The line under a result that says who produced it: "Answered by anthropic/claude-haiku-5.5 through OpenRouter",
 * "Answered by a fallback model, …", or "Answered by the rules: no AI key is set up."
 *
 * @example answeredByLine({ _tag: "Rules", reason: "No AI key is set up." }) // "Answered by the rules: No AI key is set up."
 */
export const answeredByLine = (answeredBy: AnsweredBy): string =>
  Match.valueTags(answeredBy, {
    Rules: (by) => `Answered by the rules: ${by.reason}`,
    Model: (by) =>
      `Answered by ${by.fallback ? "a fallback model, " : ""}${by.model} through ${providerName(by.provider)}`
  })
