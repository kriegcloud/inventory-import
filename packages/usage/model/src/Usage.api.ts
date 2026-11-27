// What the server may send to the usage model: the take of one model call, and nothing to read. Only the site's
// Worker reaches it, over the service binding, never a browser (decision 31); it is declared here and served at the
// hosted half of move 2. Every kind is listed, since a kind left out is served whole
// (`@alchemy.run/domain/src/Api.ts:74-93`). The one thing not to break: `TakeCall` is on this Api only.
import * as Domain from "@alchemy.run/domain"
import { Usage } from "./Usage.model.ts"

/** The server's Api over the usage model: `TakeCall` before every model call, and no read. */
export class UsageServerApi extends Domain.Api(
  "UsageServerApi",
  { model: Usage, commands: ["TakeCall"], views: [], streams: [], queries: [] },
  { description: "What the server sends to the usage model: one model call taken before a model is asked" }
) {}
