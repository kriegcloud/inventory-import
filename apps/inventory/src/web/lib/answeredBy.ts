// Who answered a result a model may have helped with, in words for the screen. The sentences are the contract's
// (`src/api/v1/ModelTrouble.ts`), so the server words its `AiUnavailable` with the same ones.
import type { AnsweredBy } from "@inventory/catalog-contract/Answer"
import { type ModelTrouble, modelSentences } from "@inventory/catalog-contract/AiUnavailable"
/**
 * Why a model did not answer, in five words the screen knows (`ModelTrouble`), and the five sentences
 * (`modelSentences`). Both are the contract's (`src/api/v1/ModelTrouble.ts`), so the server words its `AiUnavailable`
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
  answeredBy._tag === "Rules"
    ? `Answered by the rules: ${answeredBy.reason}`
    : `Answered by ${answeredBy.fallback ? "a fallback model, " : ""}${answeredBy.model} through ${providerName(answeredBy.provider)}`
