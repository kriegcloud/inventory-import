// What the table assistant is sent: the person's request in words and the table's columns, which every answer is
// checked against.
import * as S from "effect/Schema"
import { ColumnCatalog, maxPrompt } from "./View.read.ts"

// The table assistant: a request typed in words becomes a checked change to the person's own view of a table. Any
// signed-in member may use it, because it changes nothing stored; it is still a POST under the identity middleware,
// so the session, the organization and the same-origin rule apply as everywhere else.

// The limit is checked after the trim, so the document's own `maxLength` cannot state it: the sentence does.
const promptDescription = `What the person wants to see, in their words. Spaces around it are dropped; what is left is 1 to ${maxPrompt} characters`

/** What the screen sends: the person's request and the table's columns, which every answer is checked against. */
export const ViewRequest = S.Struct({
  prompt: S.Trim.check(S.isNonEmpty(), S.isMaxLength(maxPrompt))
    .pipe(S.annotateEncoded({ description: promptDescription, examples: ["only kilograms, cheapest first"] }))
    .annotateKey({ description: promptDescription, messageMissingKey: "Type what you want to see in the table." }),
  table: S.String.check(S.isMinLength(1), S.isMaxLength(40)).annotateKey({
    description: 'Which table the request is about, as the person reads its name ("Items")',
    examples: ["Items"]
  }),
  columns: ColumnCatalog,
  searchable: S.Boolean.annotateKey({ description: "The table has a search box over every column" })
}).annotate({ identifier: "ViewRequest", description: "A request for a view of a table, with the table's columns" })
/** The decoded value of `ViewRequest`. */
export type ViewRequest = typeof ViewRequest.Type
