// The suggestions of an import, as the import's handlers ask for them: the stored ones, and asking for more. Who
// answers (a model or the rules) and where they are stored is the host's.
import { Context, Effect } from "effect"
import { OrganizationId } from "@inventory/kernel/Ids"
import { Suggestion } from "@inventory/catalog-contract/Suggestion"
import { Member } from "@inventory/kernel/Member"
import { type SuggestSource } from "./Suggest.rules.ts"
import { AnsweredBy } from "@inventory/catalog-contract/Answer"

/** The suggestions of an import: reading them for the review, and asking for more. */
export class Suggestions extends Context.Service<
  Suggestions,
  {
    /** Every suggestion stored for the import, oldest first: what the review is given, on the server and the screen. */
    list(organizationId: OrganizationId, importId: string): Effect.Effect<ReadonlyArray<Suggestion>>
    /**
     * Asks for suggestions for what is still open in the import and stores the ones that pass the guard, with one
     * audit line, in one batch. A row that has a suggestion keeps it, so a second request stores nothing twice.
     * Returns what this request stored and who answered.
     */
    suggest(
      actor: Member,
      input: { readonly importId: string; readonly fileName: string; readonly source: SuggestSource }
    ): Effect.Effect<{
      readonly made: ReadonlyArray<Suggestion>
      readonly answeredBy: AnsweredBy
      readonly lines: ReadonlyArray<string>
    }>
  }
>()("@inventory/catalog-model/Suggestion/Suggestions.store/Suggestions") {}
