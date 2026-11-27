// Every event an act on a group folds, as one union told by its `_tag`.
import * as S from "effect/Schema"
import * as GroupDecided from "./GroupDecided.event.ts"
import * as GroupUndone from "./GroupUndone.event.ts"

/**
 * **Details**
 *
 * The cases are told apart by `_tag`: `GroupEvent.guards.GroupDecided` and `GroupEvent.guards.GroupUndone`.
 *
 * @category models
 * @since 0.0.0
 */
export const GroupEvent = S.Union([GroupDecided.Event, GroupUndone.Event])
  .annotate({ description: "An event an act on a group of rows folds: the act, or its undo" })
  .pipe(S.toTaggedUnion("_tag"))
/**
 * The decoded value of `GroupEvent`: a `GroupDecided` or a `GroupUndone` event.
 *
 * @category models
 * @since 0.0.0
 */
export type GroupEvent = typeof GroupEvent.Type
