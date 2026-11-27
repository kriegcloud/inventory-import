// Forget who asked for a suggestion on an import: the member's id is blanked in each `SuggestionRecorded` they
// recorded. A trial block of the module-taxonomy exploration (decision 9c), never copied into a package.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import * as SuggestionRecorded from "./events/SuggestionRecorded.event.ts"
import { Import } from "./Import.aggregate.ts"

/**
 * **Details**
 *
 * It is pure and has no Live. It keeps every event, and replaces a `SuggestionRecorded` of the member with one whose
 * `by` is empty, so the import's count of suggestions stays as it was.
 *
 * @category behavior
 * @since 0.0.0
 */
export class ForgetMember extends Domain.Rewrite(
  "ForgetMember",
  {
    of: Import,
    input: { memberId: S.String },
    events: {
      SuggestionRecorded: (event, { memberId }) =>
        event.by === memberId ? SuggestionRecorded.Event.make({ by: "" }) : event
    }
  },
  { description: "Forget a member's id on the suggestions they asked for on an import" }
) {}
