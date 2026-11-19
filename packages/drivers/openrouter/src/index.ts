/**
 * Structured answers from OpenRouter through `effect/ai`: one retry policy, a bad answer never retried, and a failure a
 * product can word. The test layers are their own subpath, `@beep/openrouter/OpenRouterTest`.
 *
 * @packageDocumentation
 */
export { ModelPolicy, OpenRouterSettings } from "./OpenRouter.config.ts"
export { ModelUnavailable } from "./OpenRouter.errors.ts"
export {
  isTransient,
  ModelAccess,
  modelAccessOf,
  ModelAnswered,
  ModelId,
  ModelName,
  ModelPrompt,
  ModelStatus,
  modelStatusOf,
  ModelTrouble,
  ModelUsage,
  OffReason,
  troubleOf
} from "./OpenRouter.schema.ts"
export { type AnswerSchema, type ModelAnswer, OpenRouter } from "./OpenRouter.service.ts"
