// What a screen of the import's organization may see of one import: its status, the number of its last change and who
// last asked for a suggestion, folded from its events. A trial block of the module-taxonomy exploration (decision 9c),
// never copied into a package.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import { Change } from "../Review/Change.schema.ts"
import { Import } from "./Import.aggregate.ts"
import { NotPermitted } from "./Import.rejection.ts"
import * as ImportState from "./Import.state.ts"

/**
 * **Details**
 *
 * `organizationId` is none until the import is staged; `ImportStatusLive` reads it to judge who may see the rest.
 *
 * @category models
 * @since 0.0.0
 */
export class Status extends S.Opaque<Status, { readonly brand: unique symbol }>()(
  S.Struct({
    status: ImportState.Status.pipe(S.annotateKey({ description: "Where the import is in its lifecycle" })),
    organizationId: S.OptionFromNullOr(S.String).pipe(
      S.annotateKey({ description: "The organization the import belongs to; none until it is staged" })
    ),
    changes: Change.pipe(
      S.annotateKey({ description: "The number of the import's last change; 0 before any" }),
      S.withConstructorDefault(Effect.succeed(0))
    ),
    askedBy: S.OptionFromNullOr(S.String).pipe(
      S.annotateKey({ description: "Who last asked for a suggestion; none for nobody, or for a member forgotten" })
    )
  }).annotate({ description: "An import's status, the number of its last change and who last asked for a suggestion" })
) {}

/**
 * **Details**
 *
 * Keyed by the import it reads. Its reads are guarded: `Session` provides who asks, and `ImportStatusLive` judges each
 * read against the import's organization.
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
    initial: Status.make({ status: "Unstaged", organizationId: O.none(), askedBy: O.none() }),
    evolve: {
      ImportStaged: (v, e) =>
        Status.make({ ...v, status: "Open", organizationId: O.some(e.organizationId), changes: 0 }),
      ColumnMatched: (v, e) => Status.make({ ...v, changes: e.change }),
      ActCounted: (v, e) => Status.make({ ...v, changes: e.change }),
      GroupCounted: (v, e) => Status.make({ ...v, changes: e.change }),
      SuggestionRecorded: (v, e) => Status.make({ ...v, askedBy: O.liftPredicate(e.by, Str.isNonEmpty) }),
      ImportConfirmed: (v, e) => Status.make({ ...v, status: "Imported", changes: e.change }),
      ImportTakenBack: (v, e) => Status.make({ ...v, status: "TakenBack", changes: e.change }),
      ImportReopened: (v, e) => Status.make({ ...v, status: "Open", changes: e.change }),
      ImportRemoved: (v, e) => Status.make({ ...v, status: "Removed", changes: e.change })
    },
    middleware: [Session],
    rejects: [NotPermitted]
  },
  { description: "One import's status, the number of its last change and who last asked for a suggestion" }
) {}

/**
 * Refuses `NotPermitted` to a person when the import is of another organization than the one they act in.
 *
 * **Details**
 *
 * An import with no status yet, or not yet staged, reads as it is to everyone. It cannot be refused: the library
 * judges a read before it waits for the caller's own writes (`atLeast`), so a refusal there would refuse the person
 * who just staged it. So another organization can tell an import id in use from one that is not, and sees nothing
 * more.
 *
 * @category layers
 * @since 0.0.0
 */
export const ImportStatusLive = ImportStatus.toLayer(
  Effect.succeed(
    Effect.fn("ImportStatus.validate")(function* (_request, status) {
      const actor = yield* CurrentActor
      const owner = O.flatMap(O.fromNullOr(status), (seen) => seen.organizationId)
      if (O.exists(owner, (organizationId) => organizationId !== actor.organizationId)) {
        return yield* NotPermitted.make({})
      }
    })
  )
)
