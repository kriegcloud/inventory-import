// What a screen may see of one import: its status, the number of its last change and who last asked for a suggestion,
// folded from its events. A trial block of the module-taxonomy exploration (decision 9c), never copied into a package.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import { Change } from "../Review/Change.schema.ts"
import { Import } from "./Import.aggregate.ts"

/**
 * @category views
 * @since 0.0.0
 */
export class Status extends S.Opaque<Status, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.Literals(["Unstaged", "Open", "Imported", "TakenBack", "Removed"]).pipe(
      S.annotateKey({ description: "Where the import is in its lifecycle" })
    ),
    changes: Change.pipe(S.annotateKey({ description: "The number of the import's last change; 0 before any" })),
    askedBy: S.String.pipe(S.annotateKey({ description: "Who last asked for a suggestion; empty for nobody" }))
  }).annotate({ description: "An import's status, the number of its last change and who last asked for a suggestion" })
) {}

/**
 * **Details**
 *
 * Keyed by the import it reads. It declares no middleware and no rejection, so it needs no Live.
 *
 * @category views
 * @since 0.0.0
 */
export class ImportStatus extends Domain.View(
  "ImportStatus",
  {
    from: [Import],
    key: Import,
    state: Status,
    initial: Status.make({ status: "Unstaged", changes: 0, askedBy: "" }),
    evolve: {
      ImportStaged: (v) => Status.make({ ...v, status: "Open", changes: 0 }),
      ColumnMatched: (v, e) => Status.make({ ...v, changes: e.change }),
      ActCounted: (v, e) => Status.make({ ...v, changes: e.change }),
      GroupCounted: (v, e) => Status.make({ ...v, changes: e.change }),
      SuggestionRecorded: (v, e) => Status.make({ ...v, askedBy: e.by }),
      ImportConfirmed: (v, e) => Status.make({ ...v, status: "Imported", changes: e.change }),
      ImportTakenBack: (v, e) => Status.make({ ...v, status: "TakenBack", changes: e.change }),
      ImportReopened: (v, e) => Status.make({ ...v, status: "Open", changes: e.change }),
      ImportRemoved: (v, e) => Status.make({ ...v, status: "Removed", changes: e.change })
    }
  },
  { description: "One import's status, the number of its last change and who last asked for a suggestion" }
) {}
