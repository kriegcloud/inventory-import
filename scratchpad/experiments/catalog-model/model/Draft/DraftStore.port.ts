// The draft store's port: the one door the trial projection writes rows through and the trial query reads them back
// through. A trial block of the module-taxonomy exploration (decision 9c), never copied into a package.
import * as Domain from "@alchemy.run/domain"
import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { Change, ImportKey } from "../Review/Change.schema.ts"

/**
 * @category models
 * @since 0.0.0
 */
export class DraftRow extends S.Opaque<DraftRow, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String.pipe(
      S.annotateKey({ description: "The event it came from, as `<stream>:<seq>`; a replay upserts it" })
    ),
    importId: ImportKey.pipe(S.annotateKey({ description: "The import the row belongs to" })),
    row: S.String.pipe(S.annotateKey({ description: "The row's instance, as `<importId>/<row>`" })),
    organizationId: S.String.pipe(S.annotateKey({ description: "The organization the import belongs to" })),
    change: Change.pipe(S.annotateKey({ description: "The change of the import that decided the row" })),
    label: S.String.pipe(S.annotateKey({ description: "What the act is called on screen" })),
    by: S.String.pipe(S.annotateKey({ description: "Whose decision it is" }))
  }).annotate({ description: "One decided row of an import's draft, as the review reads it back" })
) {}

/**
 * Where the draft of an import's review is kept: rows go in by the event they came from, and come back a page at a
 * time for one import, by keyset on their id.
 *
 * @category ports
 * @since 0.0.0
 */
export class DraftStore extends Context.Service<
  DraftStore,
  {
    readonly record: (rows: ReadonlyArray<DraftRow>) => Effect.Effect<void>
    readonly forImport: (
      importId: ImportKey,
      page: Domain.Query.PageRequest
    ) => Effect.Effect<Domain.Query.Page<DraftRow>>
  }
>()("@inventory/scratchpad/experiments/catalog-model/model/Draft/DraftStore.port/DraftStore") {}
