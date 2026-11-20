// The catalog's HTTP contract: imports, items and the table assistant. The app adds these groups to its `Api`,
// which gives them the `/api/v1` prefix, the same-origin rule and the problem documents.
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as HttpApiSchema from "effect/http-api/HttpApiSchema"
import * as OpenApi from "effect/http-api/OpenApi"
import { ConfirmRequest, SaveRequest, StaleAccept } from "./Import/Decision.command.ts"
import { reasonForPerson } from "./internal/Described.ts"
import { StagingOutcome } from "./Staging/FileProblem.read.ts"
import { ConfirmId, ImportId, ItemId } from "./Catalog.id.ts"
import { ChangeRecord, ImportView, OpenImports, PastImports, SuggestOutcome } from "./Import/Import.read.ts"
import {
  AlreadyImported,
  ColumnNotFound,
  AcceptsTakenBack,
  DraftMoved,
  ImportKept,
  ImportNotFound,
  UploadNotFound
} from "./Import/Import.rejection.ts"
import { ItemEdit, StoredItem } from "./Item/Item.read.ts"
import { ItemFacets, ItemPage, ItemQuery } from "./Item/ItemQuery.command.ts"
import { Field, StagedTable } from "./Staging/Staged.read.ts"
import { ViewOutcome } from "./Assistant/View.read.ts"
import { UploadChunk, UploadDiscard, UploadStart } from "./Staging/Upload.command.ts"
import { ViewRequest } from "./Assistant/View.command.ts"
import { Forbidden } from "@inventory/kernel/AccessError"
import { Identity } from "@inventory/kernel/Identity"
import { nullAsNone } from "@inventory/kernel/Wire"

const importId = {
  id: ImportId.annotateKey({
    description: "The id `beginUpload` answered: the upload's, and the import's once the upload has finished"
  })
}

/**
 * Bringing a file in: stage it, read it back, confirm it. Reading needs membership of the organization; staging
 * and confirming need the editor role. The browser never sends an item: it sends the file's rows once, and the
 * server works out what to write from them.
 */
export class ImportsApi extends HttpApiGroup.make("imports")
  .add(
    // Declared before `/:id`, which would read "open" as an id.
    HttpApiEndpoint.get("open", "/open", { success: OpenImports })
      .annotate(OpenApi.Summary, "The imports nobody has confirmed yet")
      .annotate(
        OpenApi.Description,
        "Every import that is still open, each as its own file, so a person who loaded two files (a .csv and an .xlsx of the same list) can continue either or remove either. The newest are sent in full; `older` counts the rest. Any member may read it."
      ),
    HttpApiEndpoint.get("past", "/past", { success: PastImports })
      .annotate(OpenApi.Summary, "The imports that were confirmed")
      .annotate(
        OpenApi.Description,
        "Every import confirmed at least once, last confirmed first, so a person can open its result again: what it imported, the rows it left out and the take-back. Counts are read from the stored items. Any member may read it."
      ),
    HttpApiEndpoint.get("changes", "/changes", {
      success: S.Array(ChangeRecord).annotate({
        description: "Every value the organization's imports wrote that differs from its file, newest first"
      })
    })
      .annotate(OpenApi.Summary, "Every value an import wrote that differs from its file")
      .annotate(
        OpenApi.Description,
        "Every changed value the organization's imports wrote, newest first: what the file said, what was stored, and who decided it. Any member may read it."
      ),
    HttpApiEndpoint.post("beginUpload", "/uploads", {
      payload: UploadStart,
      success: StagingOutcome(S.Struct({ id: ImportId.annotateKey({ description: "The upload's id" }) })),
      error: Forbidden
    })
      .annotate(OpenApi.Summary, "Start an upload with the file's head")
      .annotate(
        OpenApi.Description,
        "A file arrives in pieces, so a large one never blocks a screen or a request: begin with the file's head, send the rows in chunks, then finish. A begin sent again with the same `key` (a retry after a lost answer) is the same upload, not a second one. Until it finishes nothing reads it, so a cancelled or failed upload leaves nothing anyone could confirm. Answers 200 with a `StagingOutcome`: the upload's id, or the file's problem (`FileProblem`) as data the screen shows; its errors are only what is not about the file. Needs the editor role."
      ),
    HttpApiEndpoint.put("putChunk", "/uploads/:id/chunks", {
      params: importId,
      payload: UploadChunk,
      success: StagingOutcome(
        S.Struct({
          seq: S.Int.annotateKey({ description: "The piece stored" }),
          rows: S.Int.annotateKey({ description: "Rows in it" })
        })
      ),
      error: [Forbidden, UploadNotFound]
    })
      .annotate(OpenApi.Summary, "Send one piece of an upload's rows")
      .annotate(
        OpenApi.Description,
        "One piece of the rows, in file order. Safe to send again: a piece sent twice with the same `seq` is stored once. Answers 200 with what was stored, or the file's problem as data. Needs the editor role."
      ),
    HttpApiEndpoint.post("finishUpload", "/uploads/:id/finish", {
      params: importId,
      success: StagingOutcome(ImportView),
      error: [Forbidden, UploadNotFound]
    })
      .annotate(OpenApi.Summary, "Turn a complete upload into an import")
      .annotate(
        OpenApi.Description,
        "Turns the upload into an import in one batch. The import keeps the upload's id, and finishing again returns the same import. Answers 200 with the import, or the file's problem as data. Needs the editor role."
      ),
    HttpApiEndpoint.delete("discardUpload", "/uploads/:id", {
      params: importId,
      success: UploadDiscard,
      error: Forbidden
    })
      .annotate(OpenApi.Summary, "Cancel an upload and delete what arrived")
      .annotate(
        OpenApi.Description,
        "Cancel: deletes the upload and every piece that arrived. An upload that already finished is left as it is. Needs the editor role."
      ),
    HttpApiEndpoint.get("get", "/:id", { params: importId, success: ImportView, error: ImportNotFound })
      .annotate(OpenApi.Summary, "One import as the server has it now")
      .annotate(
        OpenApi.Description,
        "The import without its rows: which column fills each field, the saved decisions, the progress, and, once confirmed, its result, its history and what a take-back would do. Any member may read it."
      ),
    HttpApiEndpoint.get("table", "/:id/table", {
      params: importId,
      success: StagedTable,
      error: ImportNotFound
    })
      .annotate(OpenApi.Summary, "An import's staged rows")
      .annotate(
        OpenApi.Description,
        "The file's rows as they were staged. They never change after the upload, so the screen fetches them once. Any member may read it."
      ),
    HttpApiEndpoint.post("match", "/:id/mapping", {
      params: importId,
      payload: S.Struct({
        field: Field.annotateKey({
          description: "The item field to fill",
          examples: ["uom"],
          messageMissingKey: "Say which field of the item to match."
        }),
        column: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
          nullAsNone({
            description: "The file column's position, from 0, that fills the field; null for none",
            messageMissingKey: "Say which column of the file fills the field, or null for none."
          })
        )
      }),
      success: ImportView,
      error: [Forbidden, ImportNotFound, AlreadyImported, ColumnNotFound]
    })
      .annotate(OpenApi.Summary, "Point a field at a file column, or at none")
      .annotate(
        OpenApi.Description,
        "Points a field at a file column, or at none (`column: null`). `column` is the column's position in the file, from 0. An accepted proposal about that field is taken back, since the value behind it can change. Refused with 409 once the import is confirmed. Needs the editor role."
      ),
    HttpApiEndpoint.post("suggest", "/:id/suggest", {
      params: importId,
      success: SuggestOutcome,
      error: [Forbidden, ImportNotFound, AlreadyImported]
    })
      .annotate(OpenApi.Summary, "Suggest what the rules cannot")
      .annotate(
        OpenApi.Description,
        "Asks for a suggestion where the fixed rules have none: a name for a row with an empty name, from its description; a category for a row whose category is not listed, from the item's name and description; a file column for a field no heading matched. A model proposes and never writes: every answer is checked, given a confidence of medium at most by the server and never by the model, stored with its evidence, and shown in the review as a proposal the person accepts or rejects. With no model, or with the day's model calls used up, the rules answer (a name from the description, nothing else) and `answeredBy` says so. Safe to send twice: a row that has a suggestion is not asked about again and nothing is stored twice. Refused with 409 once the import is confirmed. Needs the editor role."
      ),
    HttpApiEndpoint.put("decide", "/:id/decisions", {
      params: importId,
      payload: SaveRequest,
      success: S.Struct({
        revision: S.Int.annotateKey({ description: "The draft's revision after this save" }),
        changed: S.Boolean.annotateKey({
          description:
            "True when this save changed a decision, so the revision is this save's own: one more than before it. False when every row it names already stood as sent (the same save again, or somebody else decided the same): nothing was written, and the revision is whatever the draft had reached, which may hold other people's decisions the sender has not read"
        }),
        notApplied: S.Array(StaleAccept).annotateKey({
          description:
            "Accepts in this save that were not applied, each by row and field: the field's column was matched again after the revision the save names in `madeOn`. The rest of each row's decision is saved. Empty when every accept was applied"
        })
      }).annotate({
        description:
          "The decisions are saved: the draft's revision, whether this save is what moved it, and the accepts it did not apply"
      }),
      error: [Forbidden, ImportNotFound, AlreadyImported]
    })
      .annotate(OpenApi.Summary, "Save the decisions made since the last save")
      .annotate(
        OpenApi.Description,
        "Saves decisions as they are made. Only the difference travels (the rows whose decision is new, and the rows whose decision was taken back), so two screens deciding different rows do not collide. Answers the draft's revision and whether this save changed anything: a save that changed nothing (the same one sent again, or rows somebody else had already decided the same way) writes nothing and moves no revision, and its `revision` is then not the sender's own next one, so a screen that reads `changed: false` asks for the import again instead of counting on. Safe to send twice. Refused with 409 once the import is confirmed. Needs the editor role. The save names the revision of the draft its decisions were made on (`madeOn`): an accept of a proposal for a field whose column was matched again since is not applied, and the answer names it in `notApplied`; the screen then shows that row with its proposal open and says which accepts were taken back."
      ),
    HttpApiEndpoint.post("commit", "/:id/commit", {
      params: importId,
      payload: ConfirmRequest,
      success: ImportView,
      error: [Forbidden, ImportNotFound, AlreadyImported, DraftMoved, AcceptsTakenBack]
    })
      .annotate(OpenApi.Summary, "Confirm: write the items the review says are ready")
      .annotate(
        OpenApi.Description,
        "The confirm names the revision of the draft its screen shows and carries only that screen's own decisions not saved yet; the rows never travel. The server applies the saved draft and those decisions to the staged file with the same review the screen ran and writes what that says is ready, in one write with the decisions themselves and the close of the import, and only while the stored draft is still at the revision named. If the draft has moved on (somebody else decided a row, matched a column or stored a suggestion), nothing is written and the answer is 409 `DraftMoved` with the draft's revision now: read the import again, show what changed, and confirm again. Two confirms can never both pass, and a confirm never writes a decision its screen did not show. A confirm of an import already confirmed is refused with 409 `AlreadyImported` instead of running again. The answer is the import as it now is, one revision on. Needs the editor role. The decisions the confirm carries name the revision they were made on (`madeOn`), as a save does: if one of them accepts a proposal for a field whose column was matched again since, nothing is written and the answer is 409 `AcceptsTakenBack` naming each such accept."
      ),
    HttpApiEndpoint.post("takeBack", "/:id/take-back", {
      params: importId,
      payload: S.Struct({
        confirms: S.Array(ConfirmId)
          .check(S.isMinLength(1), S.isMaxLength(1000))
          .annotateKey({ description: "The confirms the screen offered to take back (TakeBackState.confirms)" })
      }),
      success: ImportView,
      error: [Forbidden, ImportNotFound]
    })
      .annotate(OpenApi.Summary, "Take a confirmed import back while its items are unchanged")
      .annotate(
        OpenApi.Description,
        "Removes the items of the listed confirms that nobody has changed since, puts back the stored items they replaced that nobody has changed since, keeps and names the ones someone changed, and records it, in one atomic write. Safe to send twice: the second changes nothing, since those confirms are no longer in force. The review's decisions stay, so the import can be reviewed again. Needs the editor role."
      ),
    HttpApiEndpoint.post("reopen", "/:id/reopen", {
      params: importId,
      success: ImportView,
      error: [Forbidden, ImportNotFound]
    })
      .annotate(OpenApi.Summary, "Open a confirmed or taken-back import again")
      .annotate(
        OpenApi.Description,
        "Opens a confirmed or taken-back import again so its rows can be decided without choosing the file again. Items it created and still has stay as they are and are skipped as already there. Needs the editor role."
      ),
    HttpApiEndpoint.delete("remove", "/:id", {
      params: importId,
      success: HttpApiSchema.NoContent,
      error: [Forbidden, ImportNotFound, ImportKept]
    })
      .annotate(OpenApi.Summary, "Remove an import nobody has confirmed")
      .annotate(
        OpenApi.Description,
        "Removes an import nobody has confirmed and answers 204 with no body: the staged file and its saved decisions, in one batch with the audit line. One that has created items is kept (409 `ImportKept`); removing again answers 404 `ImportNotFound`, since it is gone. Needs the editor role."
      )
  )
  .middleware(Identity)
  .prefix("/imports")
  .annotate(OpenApi.Title, "Imports")
  .annotate(
    OpenApi.Description,
    "Bringing a file in: stage it, read it back, confirm it, take it back. Reading needs membership of the organization; every write needs the editor role. The browser never sends an item: it sends the file's rows once, and the server works out what to write from them."
  ) {}

/**
 * `ItemQuery` as it travels in the address of a GET: the two numbers as digits, and the sorting and the filters as
 * JSON text, the way the data table kit writes them into a query string
 * (`?page=2&perPage=20&sort=[{"id":"name","desc":false}]&filters=[]&joinOperator=and`).
 */
export const ItemQueryParams = S.Struct({
  // Described on the wire side (`annotateEncoded`): the document shows what travels, and there these are text.
  page: S.FiniteFromString.pipe(
    S.decodeTo(ItemQuery.fields.page),
    S.annotateEncoded({ description: "The page, as digits: a whole number from 1 to 100000", examples: ["1"] })
  ),
  perPage: S.FiniteFromString.pipe(
    S.decodeTo(ItemQuery.fields.perPage),
    S.annotateEncoded({
      description: "Rows on a page, as digits: a whole number from 1 to 50. The table offers 10, 20, 30, 40 and 50",
      examples: ["20"]
    })
  ),
  sort: S.fromJsonString(ItemQuery.fields.sorting).pipe(
    S.annotateEncoded({
      description:
        "The order, as JSON text: at most 5 columns, first entry first. `[]` means by SKU, or best match first while searching",
      examples: ['[{"id":"name","desc":false}]']
    })
  ),
  filters: S.fromJsonString(ItemQuery.fields.filters).pipe(
    S.annotateEncoded({
      description: "The filters, as JSON text: at most 20. `[]` for none",
      examples: ["[]"]
    })
  ),
  joinOperator: ItemQuery.fields.joinOperator,
  // Optional in the address, so a client written before the search box keeps working: left out, nothing is searched.
  search: ItemQuery.fields.search.pipe(S.withDecodingDefaultKey(Effect.succeed("")))
}).annotate({
  description:
    '`ItemQuery` as it travels in the address of a GET: the two numbers as digits, the sorting and the filters as JSON text, the way the data table kit writes them into a query string (`?page=2&perPage=20&sort=[{"id":"name","desc":false}]&filters=[]&joinOperator=and&search=steel bracket`), and the search as typed, left out for none'
})
/** The decoded value of `ItemQueryParams`: `ItemQuery` as it travels in the address of a GET. */
export type ItemQueryParams = typeof ItemQueryParams.Type

/** The item id in the address matches no item of the caller's organization: never there, or taken back. */
export class ItemNotFound extends S.TaggedError<ItemNotFound, { readonly brand: unique symbol }>()(
  "ItemNotFound",
  { reason: reasonForPerson },
  {
    description:
      "The item id in the address matches no item of the caller's organization: it was never there, or it was taken back",
    httpApiStatus: 404
  }
) {}

/**
 * The edit was made on an older revision of the item and says something else than what is stored now: someone
 * changed it in between. Nothing was written; `item` is the item as it is now, for the screen to show.
 */
export class ItemChanged extends S.TaggedError<ItemChanged, { readonly brand: unique symbol }>()(
  "ItemChanged",
  { reason: reasonForPerson, item: StoredItem },
  {
    description:
      "The edit was made on an older revision of the item and says something else than what is stored now: someone changed it in between",
    httpApiStatus: 409
  }
) {}

/**
 * The items an organization has. Items are created by confirming an import; an editor can change one afterwards,
 * which also means the import that created it can no longer take it back.
 */
export class ItemsApi extends HttpApiGroup.make("items")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: S.Array(StoredItem).annotate({ description: "Every item of the organization, by SKU" })
    })
      .annotate(OpenApi.Summary, "Every item of the organization")
      .annotate(
        OpenApi.Description,
        "Every item the caller's organization has, by SKU, in one answer, unpaged. Any member may read it."
      ),
    HttpApiEndpoint.get("page", "/page", { query: ItemQueryParams, success: ItemPage })
      .annotate(OpenApi.Summary, "One page of items, sorted and filtered")
      .annotate(
        OpenApi.Description,
        "One page of the items, sorted and filtered in SQL: what the Items table shows. `sort` and `filters` travel as JSON text in the address; `search` finds every word in any order. Any member may read it."
      ),
    HttpApiEndpoint.get("facets", "/facets", { success: ItemFacets })
      .annotate(OpenApi.Summary, "What the item filters can offer")
      .annotate(
        OpenApi.Description,
        "What the table's filters can offer: the units in use, and the range of quantities and prices. Any member may read it."
      ),
    HttpApiEndpoint.put("edit", "/:id", {
      params: {
        id: ItemId.annotateKey({
          description: "The item's id, as `items.page` gives it (`id`)"
        })
      },
      payload: ItemEdit,
      success: StoredItem,
      error: [Forbidden, ItemNotFound, ItemChanged]
    })
      .annotate(OpenApi.Summary, "Change one item")
      .annotate(
        OpenApi.Description,
        "Sets every value of one item but its SKU, tags, dimensions and vendors, on the revision the person saw. Safe to send twice: the same edit again (a double click, a retry) writes nothing and answers the item. An edit made on an older revision that says something else is refused with 409 `ItemChanged`, which carries the item as it is now. A changed item can no longer be taken back with its import. Needs the editor role."
      )
  )
  .middleware(Identity)
  .prefix("/items")
  .annotate(OpenApi.Title, "Items")
  .annotate(
    OpenApi.Description,
    "The items an organization has. An item is created by confirming an import and removed by taking that import back; an editor can change one in between, and a changed item stays when its import is taken back."
  ) {}

// The table assistant: a request typed in words becomes a checked change to the person's own view of a table. Any
// signed-in member may use it, because it changes nothing stored; it is still a POST under the identity middleware,
// so the session, the organization and the same-origin rule apply as everywhere else.

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
