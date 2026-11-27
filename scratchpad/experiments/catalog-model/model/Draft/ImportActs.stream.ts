// The acts of one import's review, one entry for each act on a row, a decision or an undo, keyed by the import's id and
// not by an aggregate, and read only by the import's organization. A trial block of the module-taxonomy exploration
// (decision 9c), never copied into a package.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import { NotPermitted } from "../Import/Import.rejection.ts"
import { Change, ImportKey, Label } from "../Review/Change.schema.ts"

/**
 * **Details**
 *
 * The stream's one entry: which row of which organization, which change the act recorded (for an undo, the change it
 * took back), under which label (`undo` for an undo) and who acted.
 *
 * @category events
 * @since 0.0.0
 */
export class RowActed extends Domain.Event(
  "RowActed",
  { row: S.String, organizationId: S.String, change: Change, label: Label, by: S.String },
  { description: "A row of the import was decided, or its decision taken back" }
) {}

/**
 * **Details**
 *
 * Its one writer is `DraftRows`, keyed like it. Its reads are guarded: `Session` provides who asks, and
 * `ImportActsLive` judges each read.
 *
 * @category streams
 * @since 0.0.0
 */
export class ImportActs extends Domain.Stream(
  "ImportActs",
  { key: ImportKey, entries: [RowActed], middleware: [Session], rejects: [NotPermitted] },
  { description: "The acts of one import's review, a row at a time, in the order they were taken" }
) {}

/**
 * Refuses `NotPermitted` to a person when the import's latest act is of another organization than the one they act
 * in.
 *
 * **Details**
 *
 * An import with no act yet reads as nothing, to everyone, for the reason `ImportStatusLive` gives: a read is judged
 * before it waits for the caller's own writes. Another organization can tell an import with acts from one without.
 *
 * @category layers
 * @since 0.0.0
 */
export const ImportActsLive = ImportActs.toLayer(
  Effect.succeed(
    Effect.fn("ImportActs.validate")(function* (_request, latest) {
      const actor = yield* CurrentActor
      if (O.exists(O.fromNullOr(latest), (entry) => entry.event.organizationId !== actor.organizationId)) {
        return yield* NotPermitted.make({})
      }
    })
  )
)
