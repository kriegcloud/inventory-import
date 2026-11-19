// Every handler of the catalog context, registered through `handlersOf`: this is where a handler that reaches past
// the ports stops compiling. The three `...Endpoints` resolve the ports once and answer what each endpoint of a
// group does; the host hands them on and the app builds the group Layers.
import { assistantEndpoints, view } from "./Assistant/Assistant.handler.ts"
import { handlersOf } from "./Catalog.ports.ts"
import { importsEndpoints } from "./Import/Imports.handler.ts"
import { itemsEndpoints } from "./Item/Items.handler.ts"
import { propose, suggest } from "./Suggestion/Suggestions.handler.ts"

/** The catalog context's handlers, by name. */
export const catalogHandlers = handlersOf({
  importsEndpoints,
  itemsEndpoints,
  assistantEndpoints,
  view,
  propose,
  suggest
})
