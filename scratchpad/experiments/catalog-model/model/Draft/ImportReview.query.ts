// The decided rows of one import, a page at a time, for a person of the import's organization. A trial block of the
// module-taxonomy exploration (decision 9c), never copied into a package.
import * as Domain from "@alchemy.run/domain"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import { NotPermitted } from "../Import/Import.rejection.ts"
import { ImportKey } from "../Review/Change.schema.ts"
import { DraftRow, DraftStore } from "./DraftStore.port.ts"
import { DraftRows } from "./DraftRows.projection.ts"

/**
 * **Details**
 *
 * It waits for `DraftRows`, so a caller that passes a command's receipt reads what that command decided.
 *
 * @category queries
 * @since 0.0.0
 */
export class ImportReview extends Domain.Query(
  "ImportReview",
  {
    input: { importId: ImportKey },
    success: DraftRow,
    paged: true,
    waitsFor: [DraftRows],
    middleware: [Session],
    rejects: [NotPermitted]
  },
  { description: "The decided rows of one import, a page at a time" }
) {}

/**
 * Reads one page of the import's rows through `DraftStore`, and refuses `NotPermitted` when a row on it belongs to
 * another organization than the one the person acts in.
 *
 * @category layers
 * @since 0.0.0
 */
export const ImportReviewLive = ImportReview.toLayer(
  Effect.gen(function* () {
    const store = yield* DraftStore
    return Effect.fn("ImportReview")(function* ({ importId }, page) {
      const actor = yield* CurrentActor
      const found = yield* store.forImport(importId, page)
      if (A.some(found.entries, (row) => row.organizationId !== actor.organizationId)) {
        return yield* NotPermitted.make({})
      }
      return found
    })
  }),
  { take: { default: 50, max: 200 } }
)
