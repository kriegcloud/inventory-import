// The decision each row of one import holds, a page at a time, read in the organization of the person who asks. A
// trial block of the module-taxonomy exploration (decision 9c), never copied into a package.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import { ImportKey } from "../Review/Change.schema.ts"
import { DraftRow, DraftStore } from "./DraftStore.port.ts"
import { DraftRows } from "./DraftRows.projection.ts"

/**
 * **Details**
 *
 * It waits for `DraftRows`, so a caller that passes a command's receipt reads what that command decided. It refuses
 * nobody: another organization's import reads as an empty page, the same as one that does not exist.
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
    middleware: [Session]
  },
  { description: "The decision each row of one import holds, a page at a time" }
) {}

/**
 * Reads one page of the import's rows through `DraftStore`, scoped to the organization the person acts in. Pages are
 * small, 2 rows unless the caller asks for more and 3 at most, so the trial's stories reach a second page.
 *
 * @category layers
 * @since 0.0.0
 */
export const ImportReviewLive = ImportReview.toLayer(
  Effect.gen(function* () {
    const store = yield* DraftStore
    return Effect.fn("ImportReview.handle")(function* ({ importId }, page) {
      const actor = yield* CurrentActor
      return yield* store.forImport(actor.organizationId, importId, page)
    })
  }),
  { take: { default: 2, max: 3 } }
)
