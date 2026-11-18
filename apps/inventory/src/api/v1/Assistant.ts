import * as S from "effect/Schema"
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api"
import { ColumnCatalog, maxPrompt, ViewOutcome } from "../../domain/TableView.ts"
import { Identity } from "./Identity.ts"

// The table assistant: a request typed in words becomes a checked change to the person's own view of a table. Any
// signed-in member may use it, because it changes nothing stored; it is still a POST under the identity middleware,
// so the session, the organization and the same-origin rule apply as everywhere else.

// The limit is checked after the trim, so the document's own `maxLength` cannot state it: the sentence does.
const promptDescription = `What the person wants to see, in their words. Spaces around it are dropped; what is left is 1 to ${maxPrompt} characters`

/** What the screen sends: the person's request and the table's columns, which every answer is checked against. */
export const ViewRequest = S.Struct({
  prompt: S.Trim.check(S.isNonEmpty(), S.isMaxLength(maxPrompt))
    .annotate({ description: promptDescription })
    .pipe(S.annotateEncoded({ description: promptDescription, examples: ["only kilograms, cheapest first"] }))
    .annotateKey({ messageMissingKey: "Type what you want to see in the table." }),
  table: S.String.check(S.isMinLength(1), S.isMaxLength(40)).annotate({
    description: 'Which table the request is about, as the person reads its name ("Items")',
    examples: ["Items"]
  }),
  columns: ColumnCatalog,
  searchable: S.Boolean.annotate({ description: "The table has a search box over every column" })
}).annotate({ identifier: "ViewRequest", description: "A request for a view of a table, with the table's columns" })
/** The decoded value of `ViewRequest`. */
export type ViewRequest = typeof ViewRequest.Type

/** The table assistant's endpoint. */
export class AssistantApi extends HttpApiGroup.make("assistant")
  .add(
    HttpApiEndpoint.post("view", "/view", { payload: ViewRequest, success: ViewOutcome })
      .annotate(OpenApi.Summary, "Turn a request in words into checked changes to a table's view")
      .annotate(
        OpenApi.Description,
        "A request typed in words becomes a checked change to the person's own view of a table: a sort, a filter, a search, a column shown or hidden. Any signed-in member may use it, because it changes nothing stored. Answers 200 with the changes, or with a refusal worded for the person; the answer says whether a model or the fixed rules read the request. With no model, or with the day's model calls used up, the rules answer."
      )
  )
  .middleware(Identity)
  .prefix("/assistant")
  .annotate(OpenApi.Title, "Table assistant")
  .annotate(
    OpenApi.Description,
    "A request typed in words becomes a checked change to the person's own view of a table. It changes nothing stored, so any signed-in member may use it."
  ) {}
