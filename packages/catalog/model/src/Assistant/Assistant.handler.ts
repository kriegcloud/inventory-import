// The table assistant's endpoint: any member may ask, because it changes only their own view.
import { Effect } from "effect"
import { TableAssistant } from "./TableAssistant.store.ts"
import { ViewRequest } from "@inventory/catalog-contract/ViewRequest"
import { CurrentActor } from "@inventory/kernel/Actor"

/** What the assistant group's one endpoint does. */
export const assistantEndpoints = Effect.gen(function* () {
  const assistant = yield* TableAssistant
  return {
    view: Effect.fn("assistant.view")(function* ({ payload }: { readonly payload: ViewRequest }) {
      const actor = yield* CurrentActor
      return yield* assistant.view(actor, payload)
    })
  }
})
