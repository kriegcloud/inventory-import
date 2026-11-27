// The acts of one import's review, one entry for each row decided, keyed by the import's id and not by an aggregate.
// A trial block of the module-taxonomy exploration (decision 9c), never copied into a package.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import { Change, ImportKey } from "../Review/Change.schema.ts"

/**
 * **Details**
 *
 * The stream's one entry: which row, by which change, under which label and whose decision it is.
 *
 * @category events
 * @since 0.0.0
 */
export class RowActed extends Domain.Event(
  "RowActed",
  { row: S.String, change: Change, label: S.String, by: S.String },
  { description: "A row of the import was decided" }
) {}

/**
 * **Details**
 *
 * Its one writer is `DraftRows`, keyed like it. It declares no middleware and no rejection, so it needs no Live.
 *
 * @category streams
 * @since 0.0.0
 */
export class ImportActs extends Domain.Stream(
  "ImportActs",
  { key: ImportKey, entries: [RowActed] },
  { description: "The acts of one import's review, a row at a time, in the order they were decided" }
) {}
