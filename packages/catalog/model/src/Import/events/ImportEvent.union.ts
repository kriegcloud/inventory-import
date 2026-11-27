// Every event the import folds, as one union told by its `_tag`.
import * as S from "effect/Schema"
import * as ActCounted from "./ActCounted.event.ts"
import * as ColumnMatched from "./ColumnMatched.event.ts"
import * as GroupCounted from "./GroupCounted.event.ts"
import * as ImportConfirmed from "./ImportConfirmed.event.ts"
import * as ImportRemoved from "./ImportRemoved.event.ts"
import * as ImportReopened from "./ImportReopened.event.ts"
import * as ImportStaged from "./ImportStaged.event.ts"
import * as ImportTakenBack from "./ImportTakenBack.event.ts"
import * as SuggestionRecorded from "./SuggestionRecorded.event.ts"

/**
 * **Details**
 *
 * The cases are told by `_tag`: its own commands' events, and `ActCounted` and `GroupCounted`, which only a decision
 * records.
 *
 * **Example** (Say who acted)
 *
 * ```ts
 * import * as ActCounted from "./ActCounted.event.ts"
 * import { ImportEvent } from "./ImportEvent.union.ts"
 * import * as SuggestionRecorded from "./SuggestionRecorded.event.ts"
 *
 * const whoActed = (e: ImportEvent): string => (ImportEvent.guards.ActCounted(e) ? e.actor : e.by)
 *
 * const undo = ActCounted.Event.make({
 *   change: 4,
 *   step: "press-2",
 *   row: "row-7",
 *   label: "Undo",
 *   holds: 2,
 *   by: "member-1",
 *   actor: "member-2",
 *   flags: "",
 *   madeOn: 0
 * })
 *
 * whoActed(undo) // => "member-2"
 * whoActed(SuggestionRecorded.Event.make({ by: "member-1" })) // => "member-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ImportEvent = S.Union([
  ImportStaged.Event,
  ColumnMatched.Event,
  ActCounted.Event,
  GroupCounted.Event,
  SuggestionRecorded.Event,
  ImportConfirmed.Event,
  ImportTakenBack.Event,
  ImportReopened.Event,
  ImportRemoved.Event
])
  .annotate({ description: "An event the import folds, its own or one a decision records on it" })
  .pipe(S.toTaggedUnion("_tag"))
/**
 * An event the import folds, as `ImportEvent` decodes it.
 *
 * @category models
 * @since 0.0.0
 */
export type ImportEvent = typeof ImportEvent.Type
