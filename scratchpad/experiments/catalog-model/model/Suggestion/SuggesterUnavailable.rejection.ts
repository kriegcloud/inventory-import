// The one way the suggester can refuse: it answered nothing usable, and why. A trial block of the module-taxonomy
// exploration (decision 9c), never copied into a package.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"

/**
 * **Details**
 *
 * `kind` says why: it has no key, it refused the import, it was asked too often, it took too long, or its answer could
 * not be used. A pass that meets it ends `Rejected` with it.
 *
 * @category rejections
 * @since 0.0.0
 */
export class SuggesterUnavailable extends Domain.Rejection(
  "SuggesterUnavailable",
  {
    kind: S.Literals(["NoKey", "Refused", "TooMany", "TooSlow", "Unusable"]).pipe(
      S.annotateKey({ description: "Why the suggester answered nothing usable" })
    )
  },
  { description: "The suggester gave no patch for the import" }
) {}
