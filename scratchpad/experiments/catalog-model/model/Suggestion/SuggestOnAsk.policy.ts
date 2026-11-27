// When a suggestion is asked for on an import, start a pass of the suggester over it. A trial block of the
// module-taxonomy exploration (decision 9c), never copied into a package.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import { Import } from "../Import/Import.aggregate.ts"
import * as SuggestionRecorded from "../Import/events/SuggestionRecorded.event.ts"
import { SuggestionPass } from "./SuggestionPass.saga.ts"

/**
 * **Details**
 *
 * It reacts to the import's `SuggestionRecorded` and sends no command, so it has no rejection to handle.
 *
 * @category policies
 * @since 0.0.0
 */
export class SuggestOnAsk extends Domain.Policy(
  "SuggestOnAsk",
  { from: Import, on: [SuggestionRecorded.Event] },
  { description: "Start a pass of the suggester when a suggestion is asked for" }
) {}

/**
 * Starts `SuggestionPass` keyed by the import the event came from. A redelivery finds the run already started.
 *
 * @category layers
 * @since 0.0.0
 */
export const SuggestOnAskLive = SuggestOnAsk.toLayer(
  Effect.gen(function* () {
    const passes = yield* SuggestionPass
    return Effect.fn("SuggestOnAsk")(function* ({ source }) {
      yield* passes.start(source, {})
    })
  })
)
