// The table assistant, as its endpoint asks for it: a request in words becomes checked changes to a view. Who
// answers (a model or the rules) is the host's.
import { Context, Effect } from "effect"
import { Member } from "@inventory/kernel/Member"
import { ViewRequest } from "@inventory/catalog-contract/ViewRequest"
import { ViewOutcome } from "@inventory/catalog-contract/TableView"

/**
 * Reads table requests for the person signed in. A model answers when there is a key and it can be reached; the
 * rules answer otherwise and the answer says why. Answers are data (`ViewOutcome`), so a refusal is a sentence the
 * screen shows, never a request error.
 */
export class TableAssistant extends Context.Service<
  TableAssistant,
  {
    /**
     * Turns a request into changes checked against its catalog. A model's answer leaves one audit line naming the
     * model; an answer from the rules is a read and leaves none.
     */
    view(actor: Member, request: ViewRequest): Effect.Effect<ViewOutcome>
  }
>()("@inventory/catalog-model/Assistant/TableAssistant.store/TableAssistant") {}
