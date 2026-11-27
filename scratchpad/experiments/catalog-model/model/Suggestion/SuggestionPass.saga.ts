// One pass of the suggester for one ask on an import: a single step that asks it for a patch. A trial block of the
// module-taxonomy exploration (decision 9c), never copied into a package.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as Activity from "effect/workflow/Activity"
import { ImportKey, Patch } from "../Review/Change.schema.ts"
import { SuggesterUnavailable } from "./SuggesterUnavailable.rejection.ts"
import { Suggester } from "./Suggester.external.ts"

/**
 * **Details**
 *
 * The ask's `SuggestionRecorded`, as `<importId>:<seq>`: the import's id and the event's place in the import's stream.
 * A saga's key is its run's idempotency key, so each ask gets its own pass and the same ask delivered again finds the
 * pass it started.
 *
 * @category models
 * @since 0.0.0
 */
export const PassKey = S.String.check(S.isPattern(/^.+:\d+$/))
  .pipe(S.brand("PassKey"))
  .annotate({ description: "One ask for a suggestion, as `<importId>:<seq>` of its event" })
/**
 * The decoded value of `PassKey`.
 *
 * @category models
 * @since 0.0.0
 */
export type PassKey = typeof PassKey.Type

/**
 * **Details**
 *
 * Keyed by the ask (`PassKey`), with the import as its input. It records nothing on the import: the patch it is
 * answered with is the pass's own. A suggester that fails with `SuggesterUnavailable` ends the pass `Rejected` with
 * it; a defect ends it `Died`.
 *
 * @category sagas
 * @since 0.0.0
 */
export class SuggestionPass extends Domain.Saga(
  "SuggestionPass",
  { key: PassKey, input: { importId: ImportKey }, rejects: [SuggesterUnavailable] },
  { description: "One pass of the suggester for one ask on an import" }
) {}

/**
 * Runs the pass as one step, `suggest`, that calls `Suggester.suggest` for the import and keeps its patch or its
 * refusal.
 *
 * @category layers
 * @since 0.0.0
 */
export const SuggestionPassLive = SuggestionPass.toLayer(
  Effect.gen(function* () {
    const suggester = yield* Suggester
    return Effect.fn("SuggestionPass.run")(function* ({ importId }: { readonly importId: ImportKey }) {
      yield* Activity.make({
        name: "suggest",
        success: S.Struct({ patch: Patch }),
        error: SuggesterUnavailable,
        execute: suggester.suggest({ importId })
      })
    })
  })
)
