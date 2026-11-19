// Where an import's suggestions are kept, as the suggestions handler asks for it: the stored ones, and storing new
// ones with their audit line, all or nothing. Who suggested is the handler's; this only keeps them.
import type { ImportId } from "@inventory/catalog-contract/Ids"
import { Suggestion } from "@inventory/catalog-contract/Suggestion"
import { Activity } from "@inventory/kernel/Activity"
import { ImportId as ImportIdSchema } from "@inventory/catalog-contract/Ids"
import type { OrganizationId } from "@inventory/kernel/Ids"
import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import * as S from "effect/Schema"

/** New suggestions for one import and the audit line of the request that made them: stored together or not at all. */
export class StoreSuggestions extends S.Opaque<StoreSuggestions, { readonly brand: unique symbol }>()(
  S.Struct({
    draft: ImportIdSchema,
    suggestions: S.Array(Suggestion).pipe(
      S.annotateKey({ description: "The suggestions to store, each with its id already made" })
    ),
    audit: Activity.pipe(S.annotateKey({ description: '"Asked for suggestions", written in the same batch' }))
  }).annotate({ identifier: "StoreSuggestions", description: "New suggestions for an import, with their audit line" })
) {}

/** The suggestions of an import, as stored. */
export class SuggestionStore extends Context.Service<
  SuggestionStore,
  {
    /** Every suggestion stored for the import, oldest first: what the review is given, on the server and the screen. */
    readonly list: (organizationId: OrganizationId, importId: ImportId) => Effect.Effect<ReadonlyArray<Suggestion>>
    /**
     * Stores the suggestions and the audit line in one batch, only while the import is open. A row and field that
     * already has a suggestion keeps it, so a second request stores nothing twice. Answers the ones this write stored.
     */
    readonly store: (write: StoreSuggestions) => Effect.Effect<ReadonlyArray<Suggestion>>
  }
>()("@inventory/catalog-model/Suggestion/SuggestionStore.store/SuggestionStore") {}
