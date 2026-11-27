// Every event a row folds, as one union told by its `_tag`.
import * as S from "effect/Schema"
import * as RowDecided from "./RowDecided.event.ts"
import * as StepUndone from "./StepUndone.event.ts"

/**
 * **Details**
 *
 * The cases are told apart by `_tag`: `RowEvent.guards.RowDecided` and `RowEvent.guards.StepUndone`.
 *
 * @category models
 * @since 0.0.0
 */
export const RowEvent = S.Union([RowDecided.Event, StepUndone.Event])
  .annotate({ description: "An event a row folds: a decision, or its undo" })
  .pipe(S.toTaggedUnion("_tag"))
/**
 * The decoded value of `RowEvent`: a `RowDecided` or a `StepUndone` event.
 *
 * @category models
 * @since 0.0.0
 */
export type RowEvent = typeof RowEvent.Type
