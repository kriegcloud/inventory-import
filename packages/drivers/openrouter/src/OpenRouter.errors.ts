/**
 * The one way a model call fails through this driver, as one of the five troubles a product can word.
 *
 * @packageDocumentation
 */
import * as S from "effect/Schema"
import { ModelTrouble } from "./OpenRouter.schema.ts"
import { $OpenrouterId } from "./internal/identity.ts"

const $I = $OpenrouterId.create("OpenRouterError")

/**
 * No model could answer. `trouble` says which kind; `retryable` whether trying again later may help. The provider's
 * own text went to the log, never into this error.
 *
 * @category errors
 */
export class ModelUnavailable extends S.TaggedError<ModelUnavailable, { readonly brand: unique symbol }>(
  $I`ModelUnavailable`
)(
  "ModelUnavailable",
  {
    trouble: ModelTrouble.pipe(S.annotateKey({ description: "Which of the five troubles it is" })),
    retryable: S.Boolean.pipe(
      S.annotateKey({ description: "True when trying again later may work (busy, down, too slow)" })
    )
  },
  $I.annoteError<ModelUnavailable>("ModelUnavailable", { description: "No model could answer" })
) {}
