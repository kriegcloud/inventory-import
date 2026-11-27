// One pass of the suggester over an import: a single step that asks it for a patch. A trial block of the
// module-taxonomy exploration (decision 9c), never copied into a package.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as Activity from "effect/workflow/Activity"
import { ImportKey, Patch } from "../Review/Change.schema.ts"
import { Suggester } from "./Suggester.external.ts"

/**
 * **Details**
 *
 * Keyed by the import, so one import has one pass at a time. It records nothing on the import: the patch it is
 * answered with is the pass's own.
 *
 * @category sagas
 * @since 0.0.0
 */
export class SuggestionPass extends Domain.Saga(
  "SuggestionPass",
  { key: ImportKey },
  { description: "One pass of the suggester over an import" }
) {}

/**
 * Runs the pass as one step, `suggest`, that calls `Suggester.suggest` for the import.
 *
 * @category layers
 * @since 0.0.0
 */
export const SuggestionPassLive = SuggestionPass.toLayer(
  Effect.gen(function* () {
    const suggester = yield* Suggester
    return Effect.fn("SuggestionPass")(function* ({ key }: { readonly key: ImportKey }) {
      yield* Activity.make({
        name: "suggest",
        success: S.Struct({ patch: Patch }),
        execute: suggester.suggest({ importId: key })
      })
    })
  })
)
