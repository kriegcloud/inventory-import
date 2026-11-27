// The draft store's port: the one door the trial projection writes rows through and the trial query reads them back
// through, one organization's import at a time. A trial block of the module-taxonomy exploration (decision 9c), never
// copied into a package.
import type * as Domain from "@alchemy.run/domain"
import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { Change, ImportKey, Label } from "../Review/Change.schema.ts"

/**
 * **Details**
 *
 * One entry per row: its id is the row's instance, so a later decision of the row replaces the earlier one.
 *
 * @category models
 * @since 0.0.0
 */
export class DraftRow extends S.Opaque<DraftRow, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String.pipe(S.annotateKey({ description: "The row's instance, as `<importId>/<row>`" })),
    organizationId: S.String.pipe(S.annotateKey({ description: "The organization the import belongs to" })),
    importId: ImportKey.pipe(S.annotateKey({ description: "The import the row belongs to" })),
    change: Change.pipe(S.annotateKey({ description: "The change of the import that recorded the decision" })),
    label: Label.pipe(S.annotateKey({ description: "What the decision is called on screen" })),
    by: S.String.pipe(S.annotateKey({ description: "Whose decision it is" }))
  }).annotate({ description: "The decision one row of an import holds now, as the review reads it back" })
) {}

/**
 * Where the draft of an import's review is kept: one row each, recorded by the row's instance and removed when the
 * row holds no decision any more, read back a page at a time for one organization's import, by keyset on the id.
 *
 * **Details**
 *
 * `forImport` takes the organization first, as a tenant table's index starts with it: an import of another
 * organization reads as an empty page, the same as one that does not exist.
 *
 * @category ports
 * @since 0.0.0
 */
export class DraftStore extends Context.Service<
  DraftStore,
  {
    readonly record: (rows: ReadonlyArray<DraftRow>) => Effect.Effect<void>
    readonly remove: (ids: ReadonlyArray<string>) => Effect.Effect<void>
    readonly forImport: (
      organizationId: string,
      importId: ImportKey,
      page: Domain.Query.PageRequest
    ) => Effect.Effect<Domain.Query.Page<DraftRow>>
  }
>()("@inventory/scratchpad/experiments/catalog-model/model/Draft/DraftStore.port/DraftStore") {}
