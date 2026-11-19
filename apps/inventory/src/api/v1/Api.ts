import { Effect } from "effect"
import * as S from "effect/Schema"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware, OpenApi } from "effect/http-api"
import { Activity } from "@inventory/kernel/Activity"
import { instant, personName, reasonForPerson } from "../../domain/Described.ts"
import { StagingOutcome } from "../../domain/FileProblem.ts"
import { ItemEdit, ItemFields, StoredItem } from "../../domain/Item.ts"
import {
  Change,
  ColumnMatch,
  Field,
  MappingChoice,
  SavedDecisions,
  StagedHead,
  StagedRow,
  StagedTable,
  Suggestion,
  UnusedColumn
} from "../../domain/ItemImport.ts"
import { ItemFacets, ItemPage, ItemQuery } from "../../domain/ItemQuery.ts"
import { chunkRows } from "../../domain/Upload.ts"
import { AssistantApi } from "./Assistant.ts"
import { describeDocument } from "./Document.ts"
import { IdentityApi } from "./Identity.ts"
import { Forbidden } from "@inventory/kernel/AccessError"
import { Identity } from "@inventory/kernel/Identity"
import { aiTroubles, modelSentences } from "./ModelTrouble.ts"
import { PeopleApi } from "./People.ts"
import { SameOrigin } from "@inventory/kernel/SameOrigin"
import { apiPrefix } from "./Version.ts"

// The API contract, version 1. The server implements it (src/server) and the browser calls it through a client
// derived from this same definition (src/web/lib/api.ts), so a renamed field is a compile error on both sides.
// Sign-in routes are never versioned: Better Auth answers /api/auth/*, beside this (src/server/SignIn.ts).

export { apiPrefix } from "./Version.ts"

/** The OpenAPI document generated from this contract. Served in development and in production. */
export const openApiPath = `${apiPrefix}/openapi.json` as const

/** The API reference page (Scalar). Served in development only: a production build has no such route. */
export const docsPath = `${apiPrefix}/docs` as const

/** The two model providers the server can reach, each with its own key. */
export const AiProvider = S.Literals(["openrouter", "gateway"]).annotate({
  description: "A model provider: OpenRouter (OPENROUTER_API_KEY) or the Vercel AI Gateway (AI_GATEWAY_API_KEY)."
})
/** One of the `AiProvider` names. */
export type AiProvider = typeof AiProvider.Type

/** One step of the model plan: a provider, the model asked first, and the models that provider falls back to. */
export class AiRoute extends S.Class<AiRoute, { readonly brand: unique symbol }>("AiRoute")(
  {
    provider: AiProvider,
    model: S.String.annotateKey({ description: "The model asked first on this provider (a vendor/model id)." }),
    fallbackModels: S.Array(S.String).annotateKey({
      description: "Models this provider tries, in order, when the first one fails (OpenRouter's models list)."
    })
  },
  { description: "One provider in the order the server tries them." }
) {}

/** Whether a language model can be used right now, and in which order the server will try them. */
export class AiStatus extends S.Class<AiStatus, { readonly brand: unique symbol }>("AiStatus")(
  {
    available: S.Boolean.annotateKey({ description: "False with no key, or with AI_ENABLED=false." }),
    provider: S.Literals(["openrouter", "gateway", "none"]).annotateKey({
      description: "The provider asked first, or none when AI is off."
    }),
    model: S.String.annotateKey({ description: "The model asked first (AI_MODEL), even when AI is off." }),
    routes: S.Array(AiRoute).annotateKey({
      description: "Every provider the server will try, in order. After the last, features use their non-AI path."
    }),
    reason: S.String.annotateKey({
      description: "One sentence for the screen: why AI is off, or what will answer when it is on."
    })
  },
  { description: "What will answer a model call, so nobody waits on a missing key." }
) {}

/**
 * Who produced a result that a model may have helped with: a model (which provider and model, and whether it was a
 * fallback) or the rules (the non-AI path, with the reason the model was not used). The screen says which.
 */
export const AnsweredBy = S.Union([
  S.TaggedStruct("Model", {
    provider: AiProvider,
    model: S.String.annotateKey({ description: "The model that answered, as the provider reported it." }),
    fallback: S.Boolean.annotateKey({
      description: "True when it was not the first model of the first provider: a fallback answered."
    })
  }),
  S.TaggedStruct("Rules", {
    reason: S.String.annotateKey({ description: "Why no model answered, in words for the person." })
  })
]).annotate({ identifier: "AnsweredBy", description: "Which one answered: a model, or the rules when no model could." })
/** An `AnsweredBy` value. */
export type AnsweredBy = typeof AnsweredBy.Type

/** Health of the stack as the current member sees it. The activity count is their organization's only. */
export class SystemStatus extends S.Class<SystemStatus, { readonly brand: unique symbol }>("SystemStatus")(
  {
    database: S.Struct({
      ok: S.Boolean.annotateKey({ description: "True when the database answered this request" }),
      activityCount: S.Int.annotateKey({
        description: "Audit-trail rows in the actor's organization.",
        examples: [12]
      })
    }).annotateKey({ description: "Whether the database answers, and one count read from it" }),
    ai: AiStatus
  },
  { description: "Whether the database answers and what will answer a model call." }
) {}

/** One round trip to the model, timed, so a person can see the key works before relying on it. */
export class AiCheck extends S.Class<AiCheck, { readonly brand: unique symbol }>("AiCheck")(
  {
    model: S.String.annotateKey({ description: "The model that answered." }),
    reply: S.String.annotateKey({ description: "What the model said back to the test prompt" }),
    millis: S.Int.annotateKey({
      description: "How long the whole call took, retries and fallbacks included.",
      examples: [840]
    }),
    answeredBy: AnsweredBy
  },
  { description: "The model's answer to a short test prompt, and how long it took." }
) {}

export { modelSentences } from "./ModelTrouble.ts"

/** Why no model answered, in the five cases the screens have words for (`modelSentences`). */
export const AiTrouble = S.Literals(aiTroubles).annotate({
  description:
    "noKey: no key, or AI turned off. refused: the key was refused or its account has no credit left (trying again " +
    "will not help). busy: rate-limited. badAnswer: an answer that did not fit. down: anything else."
})

/** One of the `AiTrouble` names. */
export type AiTrouble = typeof AiTrouble.Type

/**
 * The model could not be used: no key, AI turned off, a provider that is down or busy, a timeout, or an answer that
 * did not fit. `reason` is `modelSentences[kind]`, a sentence for the person (`aiUnavailable` makes it); the
 * provider's own text goes to the log, never to the screen.
 */
export class AiUnavailable extends S.TaggedError<AiUnavailable, { readonly brand: unique symbol }>()(
  "AiUnavailable",
  {
    reason: S.String.annotateKey({ description: "What happened, in words for the person. No provider text." }),
    kind: AiTrouble,
    retryable: S.Boolean.annotateKey({
      description: "True when trying again later may work (busy, down). False for no key, a refused key, a bad answer."
    })
  },
  { httpApiStatus: 503, description: "No model could answer. Features fall back to their non-AI path." }
) {}

/**
 * The failure of a model call of this kind, worded by `modelSentences`.
 *
 * @example
 * aiUnavailable({ kind: "busy", retryable: true }).reason // "The model is busy right now. Try again in a minute."
 */
export const aiUnavailable = (input: { readonly kind: AiTrouble; readonly retryable: boolean }): AiUnavailable =>
  AiUnavailable.make({ reason: modelSentences[input.kind], kind: input.kind, retryable: input.retryable })

/**
 * The organization has used the day's model calls (src/server/ModelCalls.ts): nothing was asked. Every model feature
 * draws on the same allowance; a feature with a non-AI path answers by its rules instead of failing with this.
 */
export class ModelCallsUsedUp extends S.TaggedError<ModelCallsUsedUp, { readonly brand: unique symbol }>()(
  "ModelCallsUsedUp",
  { reason: S.String.annotateKey({ description: "What happened, in words for the person." }) },
  { httpApiStatus: 429, description: "The day's model calls are used: the model was not asked." }
) {}

/** Liveness and configuration. Both endpoints name the actor: the count is tenant data and the check spends the key. */
export class SystemApi extends HttpApiGroup.make("system")
  .add(
    HttpApiEndpoint.get("status", "/status", { success: SystemStatus })
      .annotate(OpenApi.Summary, "Database health and what will answer a model call")
      .annotate(
        OpenApi.Description,
        "Whether the database answers, how many audit-trail rows the caller's organization has, and which model, if any, will answer a model call. Any member may read it."
      ),
    HttpApiEndpoint.post("checkAi", "/ai-check", {
      success: AiCheck,
      error: [AiUnavailable, Forbidden, ModelCallsUsedUp]
    })
      .annotate(OpenApi.Summary, "Ask the model for a short reply, to see the key works")
      .annotate(
        OpenApi.Description,
        "Sends one short prompt to the model and times the answer. It spends one of the organization's daily model calls, so it counts as a write: needs the editor role. Answers 503 when no model could answer and 429 when the day's calls are used up."
      )
  )
  .middleware(Identity)
  .prefix("/system")
  .annotate(OpenApi.Title, "System")
  .annotate(OpenApi.Description, "Whether the stack works, as the current member sees it.") {}

/**
 * The audit trail of the current member's organization: who did what, newest first. It is written only by the
 * things it records (an upload, an import, a take-back, a change of role), in the same batch, never by a request of
 * its own.
 */
export class ActivityApi extends HttpApiGroup.make("activity")
  .add(
    HttpApiEndpoint.get("recent", "/", {
      success: S.Array(Activity.json).annotate({ description: "The organization's audit trail, newest first" })
    })
      .annotate(OpenApi.Summary, "The organization's audit trail, newest first")
      .annotate(
        OpenApi.Description,
        "Who did what in the caller's organization, newest first. A line is written only by the thing it records (an upload, an import, a take-back, an edit, a change of role), in the same batch; no request writes one of its own. Any member may read it."
      )
  )
  .middleware(Identity)
  .prefix("/activity")
  .annotate(OpenApi.Title, "Activity")
  .annotate(
    OpenApi.Description,
    "The audit trail of the caller's organization: who did what, newest first. It is written only by the things it records, in the same batch, never by a request of its own."
  ) {}

/**
 * What the confirms did with one row of the file. `reason` is empty for a created row and for one whose item a
 * take-back removed (`takenBack`).
 */
export const RowOutcome = S.Struct({
  rowNumber: S.Int.annotateKey({ description: "The row as Excel numbers it", examples: [7] }),
  part: S.optionalKey(S.Int).annotateKey({
    description:
      "Which of its row's items this is (1, 2, ...), when the row holds several; left out for a row that is one item",
    examples: [2]
  }),
  sku: S.String.annotateKey({ description: "The item's SKU as the row gives it", examples: ["RJS-3545"] }),
  name: S.String.annotateKey({ description: "The row's name, as the result lists it", examples: ["Nylon Coil"] }),
  outcome: S.Literals(["created", "updated", "already", "notImported", "takenBack"]).annotateKey({
    description:
      "Created an item, replaced a stored item as the person chose, found the SKU already there, not imported, or taken back: the item it created was removed, or the stored item it replaced was put back as it was"
  }),
  reason: S.String.annotateKey({
    description:
      "Why the row was not imported or was already there, one sentence per problem; empty for a created row and for one a take-back removed",
    examples: ["Name is empty."]
  }),
  decidedBy: S.NullOr(S.Literals(["person", "nobody"])).annotateKey({
    description: "For a row that was not imported: the person left it out, or nobody had settled it yet"
  }),
  decidedByName: S.NullOr(S.String).annotateKey({ description: "Who left the row out, when someone did" })
}).annotate({ identifier: "RowOutcome", description: "What the confirms did with one row of the file" })
/** The decoded value of `RowOutcome`: what the confirms did with one row of the file. */
export type RowOutcome = typeof RowOutcome.Type

/** What a confirmed import did, row by row, counted from the stored rows. Kept with the import, so it survives a reload. */
export const ImportResult = S.Struct({
  importedBy: personName("Who confirmed the import"),
  importedAt: instant("When it was confirmed"),
  created: S.Int.annotateKey({ description: "Rows whose item this import created and still has", examples: [11] }),
  updated: S.Int.annotateKey({
    description: "Rows that replaced a stored item with the same SKU, because the person chose to",
    examples: [1]
  }),
  already: S.Int.annotateKey({
    description: "Rows whose SKU the organization already had: nothing was written for them",
    examples: [154]
  }),
  notImported: S.Int.annotateKey({
    description: "Rows left out, by a person or because nobody had settled them",
    examples: [45]
  }),
  takenBack: S.Int.annotateKey({
    description:
      "Rows whose item this import created and a take-back removed, or whose replace of a stored item a take-back undid",
    examples: [0]
  }),
  fixed: S.Struct({
    rows: S.Int.annotateKey({ description: "Rows written with at least one value a form-only rule changed" }),
    cells: S.Int.annotateKey({ description: "Values a form-only rule changed, in all" })
  }).annotateKey({
    description:
      'What the form-only rules changed without the person, counted from the changed values the confirms stored (`how` "applied by a rule")'
  }),
  rows: S.Array(RowOutcome).annotateKey({
    description: "Every row of the file with what happened to it; the five counts add up to these"
  })
}).annotate({ identifier: "ImportResult", description: "What the confirms of an import did with each row of its file" })
/** The decoded value of `ImportResult`: what a confirmed import did, row by row, counted from the stored rows. */
export type ImportResult = typeof ImportResult.Type

/**
 * One thing that happened to a confirmed import, for its history: a confirm, with what it did, or the take-back of
 * one, with how many of its items it removed, how many items it had replaced it put back as they were, and how many
 * it kept because they had changed since. Every number is
 * read from what the confirm and the take-back stored.
 */
export const ImportEvent = S.TaggedUnion({
  Confirmed: {
    batchId: S.String.annotateKey({ description: "The confirm's id: what a take-back names in `confirms`" }),
    by: personName("Who confirmed"),
    at: instant("When"),
    created: S.Int.annotateKey({ description: "Items this confirm created" }),
    updated: S.Int.annotateKey({ description: "Stored items this confirm replaced, as the person chose" }),
    already: S.Int.annotateKey({ description: "Rows it found already there" }),
    notImported: S.Int.annotateKey({ description: "Rows it left out" })
  },
  TakenBack: {
    batchId: S.String.annotateKey({
      description: "The first confirm the take-back reversed; one take-back of several confirms is one event"
    }),
    by: personName("Who took it back"),
    at: instant("When"),
    removed: S.Int.annotateKey({
      description: "Every item the take-back removed, across all the confirms it reversed"
    }),
    restored: S.Int.annotateKey({
      description:
        "Every stored item those confirms had replaced that the take-back put back to its values from before the replace"
    }),
    kept: S.Int.annotateKey({
      description:
        "Every item it kept because someone had changed it since (one it created, or one it replaced), across all the confirms it reversed"
    })
  }
}).annotate({ identifier: "ImportEvent", description: "A confirm of an import, or the take-back of one" })
/** The decoded value of `ImportEvent`: one thing that happened to a confirmed import, for its history. */
export type ImportEvent = typeof ImportEvent.Type

/** An item an import created that someone changed afterwards: what it is, who changed it last and when. */
export const ChangedItem = S.Struct({
  sku: S.String.annotateKey({ description: "The item's SKU" }),
  name: S.String.annotateKey({ description: "The item's name, for the list" }),
  changedBy: personName("Who changed it last"),
  changedAt: instant("When it was last changed")
}).annotate({ identifier: "ChangedItem", description: "An item changed after the import that created it" })
/** The decoded value of `ChangedItem`: an item an import created that someone changed afterwards. */
export type ChangedItem = typeof ChangedItem.Type

/** How many changed items a view lists by name; the rest are counted. */
export const changedItemsShown = 20

/**
 * Whether the import can be taken back, and what that would do, worked out from what is stored. A take-back removes
 * the items of the confirms still in force that nobody has changed since (`removable`) and puts back the stored items
 * they replaced that nobody has changed since (`restorable`); an item someone changed is kept, and named. When every
 * such item has changed, nothing can be taken back, and the screen says so.
 */
export const TakeBackState = S.Struct({
  confirms: S.Array(S.String).annotateKey({
    description: "The confirms still in force: what a take-back of the import would reverse"
  }),
  removable: S.Int.annotateKey({ description: "Items of those confirms still as the import created them" }),
  restorable: S.Int.annotateKey({
    description:
      "Stored items those confirms replaced that are still as the replace left them: a take-back puts back their values from before"
  }),
  changed: S.Array(ChangedItem).annotateKey({
    description: `Items those confirms created or replaced that someone changed since, at most ${changedItemsShown}: a take-back keeps them`
  }),
  changedCount: S.Int.annotateKey({ description: "How many items of those confirms changed since, in all" }),
  kept: S.Array(ChangedItem).annotateKey({
    description: `Items an earlier take-back of this import kept because they had changed, at most ${changedItemsShown}`
  }),
  keptCount: S.Int.annotateKey({ description: "How many items earlier take-backs kept, in all" })
}).annotate({ identifier: "TakeBackState", description: "What taking the import back would do now" })
/** The decoded value of `TakeBackState`: whether the import can be taken back, and what that would do. */
export type TakeBackState = typeof TakeBackState.Type

/**
 * One file on its way in, without its rows (those are fetched once from `table`, since they never change). While
 * `status` is `open` nothing has been stored as an item.
 */
export class ImportView extends S.Class<ImportView, { readonly brand: unique symbol }>("ImportView")(
  {
    id: S.String.annotateKey({ description: "The import's id: the id its upload was given" }),
    fileName: S.String.annotateKey({
      description: "The file's name as it was chosen",
      examples: ["items_messy.csv"]
    }),
    status: S.Literals(["open", "imported", "takenBack"]).annotateKey({
      description: "Under review, confirmed, or confirmed and then taken back"
    }),
    startedBy: personName("Who uploaded the file"),
    createdAt: instant("When the upload finished and the import began"),
    rowCount: S.Int.annotateKey({ description: "Data rows the file was uploaded with", examples: [200] }),
    storedItems: S.Array(ItemFields).annotateKey({
      description:
        "The organization's items that share a SKU with a row of this file: the review skips a row that says the same, and asks about one that says something else"
    }),
    mapping: S.Array(ColumnMatch).annotateKey({ description: "Which file column fills each field, and how" }),
    choices: S.Array(MappingChoice).annotateKey({ description: "The matches people made, as the review takes them" }),
    unusedColumns: S.Array(UnusedColumn).annotateKey({
      description: "File columns no field reads, each with how many rows hold a value in it. They are never stored"
    }),
    createdRows: S.Array(S.Int).annotateKey({
      description: "Rows an earlier confirm of this import turned into items: already there when it is opened again"
    }),
    createdIds: S.String.pipe(S.Array, S.optionalKey).annotateKey({
      description:
        "The items an earlier confirm of this import created, by row id (`row-7`, or `row-8.2` for the second item of row 8): what the review counts as already there",
      examples: [["row-7", "row-8.2"]]
    }),
    decisions: SavedDecisions.annotateKey({ description: "The saved draft: what has been decided about each row" }),
    suggestions: S.Array(Suggestion).annotateKey({
      description:
        "The stored suggestions for this import (`suggest` makes them): pass them to the review as `suggestions`, as the server does at the confirm, so each shows as a proposal on its row. A column suggestion is offered for the person to match",
      default: []
    }),
    revision: S.Int.annotateKey({ description: "Goes up with every saved decision, from any screen", examples: [3] }),
    progress: S.Struct({
      needsAtStart: S.Int.annotateKey({ description: "Rows that needed the person when the file was staged" }),
      needs: S.Int.annotateKey({ description: "Rows that still need the person: decision and cannot together" }),
      decision: S.Int.annotateKey({ description: "Rows that wait for a proposal or a choice: Needs a decision" }),
      cannot: S.Int.annotateKey({ description: "Rows that wait for a typed value: Cannot import" }),
      ready: S.Int.annotateKey({ description: "Rows a confirm would write now" }),
      fixedRows: S.Int.annotateKey({ description: "Rows with a value a form-only rule changed, still in force" }),
      fixedCells: S.Int.annotateKey({ description: "Values a form-only rule changed, still in force" }),
      rows: S.Int.annotateKey({ description: "Record rows in the file: every row but blank and total rows" })
    }).annotateKey({ description: "How far the review is: rows that needed the person at first, and now" }),
    result: S.NullOr(ImportResult).annotateKey({ description: "What the confirms did, once there has been one" }),
    history: S.Array(ImportEvent).annotateKey({
      description: "Every confirm and take-back of this import, oldest first"
    }),
    takeBack: TakeBackState
  },
  {
    description:
      "One file on its way in, without its rows (those are fetched once from `table`, since they never change)"
  }
) {}

/**
 * What a request for suggestions did: what it stored this time, everything now stored for the import, who answered
 * (a model, or the rules with the reason no model did) and what happened in past-tense lines. Nothing in it has
 * changed a row: each suggestion waits in the review for the person.
 */
export const SuggestOutcome = S.Struct({
  made: S.Array(Suggestion).annotateKey({
    description: "The suggestions this request stored; empty when it added none"
  }),
  suggestions: S.Array(Suggestion).annotateKey({
    description: "Every suggestion now stored for the import: what `ImportView.suggestions` holds from now on"
  }),
  answeredBy: AnsweredBy,
  lines: S.Array(S.String).annotateKey({
    description: "What happened, in the past tense with real counts, for the person",
    examples: [["Suggested 2 names", "Suggested 2 categories"]]
  })
}).annotate({
  identifier: "SuggestOutcome",
  description: "What a request for suggestions did: what it stored, who answered and what happened, in lines"
})
/** The decoded value of `SuggestOutcome`. */
export type SuggestOutcome = typeof SuggestOutcome.Type

/** The import id in the address matches nothing in the caller's organization. */
export class ImportNotFound extends S.TaggedError<ImportNotFound, { readonly brand: unique symbol }>()(
  "ImportNotFound",
  { reason: reasonForPerson },
  { description: "The import id in the address matches nothing in the caller's organization", httpApiStatus: 404 }
) {}

/**
 * The column position in a match is not a column of the import's file. The screen offers only the file's own
 * columns, so this is a request no screen of ours sends: a request error, not a problem with the person's file.
 */
export class ColumnNotFound extends S.TaggedError<ColumnNotFound, { readonly brand: unique symbol }>()(
  "ColumnNotFound",
  { reason: reasonForPerson },
  { description: "The column position in a match is not a column of the import's file", httpApiStatus: 404 }
) {}

/** The import was already confirmed. A second confirm is refused instead of running again. */
export class AlreadyImported extends S.TaggedError<AlreadyImported, { readonly brand: unique symbol }>()(
  "AlreadyImported",
  { reason: reasonForPerson },
  { description: "The import was already confirmed: nothing was written", httpApiStatus: 409 }
) {}

/**
 * The import cannot be removed because it has already created items: it is confirmed, or it was confirmed once and
 * opened again to finish the rows it left out. Its items, its row-by-row result and the item of who decided each
 * changed value all point at it, so it stays. Only a file nobody has confirmed yet can be removed.
 */
export class ImportKept extends S.TaggedError<ImportKept, { readonly brand: unique symbol }>()(
  "ImportKept",
  { reason: reasonForPerson },
  {
    description:
      "The import cannot be removed because it has already created items: it is confirmed, or it was confirmed once and opened again to finish the rows it left out",
    httpApiStatus: 409
  }
) {}

/**
 * How many open imports the first screen is sent in full. Each one is sent with its review worked out (the same
 * review the screen runs, over every row of the file), so the list is capped and the rest are only counted.
 */
export const openImportsShown = 5

/** The organization's imports nobody has confirmed yet, so the first screen can offer to continue or remove each. */
export const OpenImports = S.Struct({
  views: S.Array(ImportView).annotateKey({
    description: `The open imports, newest first, at most ${openImportsShown}`
  }),
  older: S.Int.annotateKey({
    description: "How many more open imports there are, older than those in views. Zero when every one is shown"
  })
}).annotate({
  identifier: "OpenImports",
  description:
    "The organization's imports nobody has confirmed yet, so the first screen can offer to continue or remove each"
})
/** The decoded value of `OpenImports`: the imports nobody has confirmed yet. */
export type OpenImports = typeof OpenImports.Type

const importId = {
  id: S.String.check(S.isMaxLength(64)).annotateKey({
    description: "The id `beginUpload` answered: the upload's, and the import's once the upload has finished"
  })
}

/**
 * The upload id matches no unfinished upload of the caller: it was cancelled, it finished already, or it was left
 * for over an hour and deleted. The rows are not on the server; the file has to be chosen again.
 */
export class UploadNotFound extends S.TaggedError<UploadNotFound, { readonly brand: unique symbol }>()(
  "UploadNotFound",
  { reason: reasonForPerson },
  {
    description:
      "The upload id matches no unfinished upload of the caller: it was cancelled, it finished already, or it was left for over an hour and deleted",
    httpApiStatus: 404
  }
) {}

/** The start of an upload: the file without its rows, and how many rows will follow in how many pieces. */
export const UploadStart = S.Struct({
  key: S.String.check(S.isMinLength(1), S.isMaxLength(64)).annotateKey({
    description:
      "Chosen by the browser for this one file: a begin sent again with the same key (a retry after a lost answer) " +
      "is the same upload, not a second one"
  }),
  head: StagedHead,
  rowCount: S.Int.annotateKey({ description: "Data rows the pieces will carry in all", examples: [13] }),
  chunkCount: S.Int.annotateKey({ description: "Pieces that will follow, numbered from 0", examples: [1] })
}).annotate({
  identifier: "UploadStart",
  description: "The start of an upload: the file without its rows, and how many rows will follow in how many pieces"
})
/** The decoded value of `UploadStart`: the start of an upload. */
export type UploadStart = typeof UploadStart.Type

/**
 * One piece of an upload's rows, in file order. `seq` is its place; sending the same piece again stores nothing new,
 * so a piece whose answer was lost on the network can simply be sent again.
 */
export const UploadChunk = S.Struct({
  seq: S.Int.check(S.isGreaterThanOrEqualTo(0)).annotateKey({
    description: "The piece's place in the file, from 0: sending a piece again with the same number stores it once",
    examples: [0]
  }),
  rows: S.Array(StagedRow)
    .check(S.isMinLength(1), S.isMaxLength(chunkRows))
    .annotateKey({ description: `The piece's rows, in file order: 1 to ${chunkRows}` })
}).annotate({ identifier: "UploadChunk", description: "One piece of an upload's rows, in file order" })
/** The decoded value of `UploadChunk`: one piece of an upload's rows, in file order. */
export type UploadChunk = typeof UploadChunk.Type

/**
 * What changed in the draft since the last save: the rows whose decision is new or different, and the rows whose
 * decision was taken back. Only the difference travels, so two screens deciding different rows do not collide.
 */
export const DecisionDelta = S.Struct({
  set: SavedDecisions.annotate({
    description: "Decisions that are new or different, by row id (`row-7`)",
    examples: [{ "row-55": { accepted: ["unitCost"] }, "row-142": { edits: { name: "Steel Tube 1in" } } }]
  }).annotateKey({
    description: "The rows decided since the last save, each with its whole decision",
    messageMissingKey: "Send `set`: the decisions that are new, by row id, or {} for none."
  }),
  clear: S.Array(S.String.check(S.isMaxLength(40)))
    .check(S.isMaxLength(50000))
    .annotate({
      description: "Row ids (`row-7`) whose decision was taken back: they go back to what the file says",
      examples: [["row-18"]]
    })
    .annotateKey({
      description: "The rows whose decision was undone since the last save",
      messageMissingKey: "Send `clear`: the row ids whose decision was taken back, or [] for none."
    })
}).annotate({
  identifier: "DecisionDelta",
  description:
    "What changed in the draft since the last save: the rows whose decision is new or different, and the rows whose decision was taken back"
})
/** The decoded value of `DecisionDelta`: what changed in the draft since the last save. */
export type DecisionDelta = typeof DecisionDelta.Type

/** How many past imports the first screen and the activity view are sent. The rest are counted. */
export const pastImportsShown = 50

/**
 * One import that was confirmed at least once, as a list shows it so the person can open its result again: the file,
 * who confirmed it last and when, and how many of its items are stored now, counted from the items themselves.
 */
export const PastImport = S.Struct({
  id: S.String.annotateKey({ description: "The import's id: its result is at `/?import=<id>&step=result`" }),
  fileName: S.String.annotateKey({ description: "The file it came from", examples: ["items_messy.csv"] }),
  rowCount: S.Int.annotateKey({ description: "The rows of the file", examples: [200] }),
  status: S.Literals(["open", "imported", "takenBack"]).annotateKey({
    description:
      "imported: confirmed and in force; takenBack: its last confirm was taken back; open: confirmed once, then opened again to finish the rows it left out"
  }),
  confirmedByName: personName("Who confirmed it last"),
  confirmedAt: instant("When it was confirmed last"),
  items: S.Int.annotateKey({
    description: "How many items in the system came from this import now, counted from the stored items",
    examples: [155]
  }),
  notImported: S.Int.annotateKey({ description: "Rows its last confirm did not import", examples: [45] })
}).annotate({
  identifier: "PastImport",
  description: "One import that was confirmed at least once, so its result can be opened again"
})
/** The decoded value of `PastImport`. */
export type PastImport = typeof PastImport.Type

/** The organization's confirmed imports, newest first, and how many older ones were left out. */
export const PastImports = S.Struct({
  imports: S.Array(PastImport).annotateKey({
    description: `The confirmed imports, last confirmed first, at most ${pastImportsShown}`
  }),
  older: S.Int.annotateKey({ description: "How many more there are, older than those listed. Zero when all are" })
}).annotate({ identifier: "PastImports", description: "The organization's confirmed imports, newest first" })
/** The decoded value of `PastImports`. */
export type PastImports = typeof PastImports.Type

/** One changed value of an imported row as the activity view shows it: the file it came from, when, and who. */
export const ChangeRecord = S.Struct({
  importId: S.String.annotateKey({ description: "The import that wrote the value" }),
  fileName: S.String.annotateKey({ description: "That import's file" }),
  rowNumber: S.Int.annotateKey({ description: "The row of the file, as Excel numbers it" }),
  part: S.optionalKey(S.Int).annotateKey({
    description:
      "Which of its row's items the value went into (1, 2, ...), when the row holds several; left out for a row that is one item"
  }),
  sku: S.String.annotateKey({ description: "The SKU of the item the value went into" }),
  ...Change.fields,
  decidedByName: S.NullOr(S.String).annotateKey({ description: "The member who accepted or typed it" }),
  createdAt: instant("When the import wrote it"),
  takenBack: S.Boolean.annotateKey({
    description:
      "True when the import was taken back and the item this value went into was removed with it, or, for a stored item it replaced, put back as it was"
  })
}).annotate({ identifier: "ChangeRecord", description: "One value an import wrote that differs from its file" })
/** The decoded value of `ChangeRecord`: one changed value of an imported row as the activity view shows it. */
export type ChangeRecord = typeof ChangeRecord.Type

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
      success: StagingOutcome(S.Struct({ id: S.String.annotateKey({ description: "The upload's id" }) })),
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
      success: S.Struct({
        discarded: S.Boolean.annotateKey({
          description: "True when an unfinished upload was deleted; false when there was none (finished, or gone)"
        })
      }).annotate({ description: "Whether an unfinished upload was deleted" }),
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
        column: S.NullOr(S.Int.check(S.isGreaterThanOrEqualTo(0))).annotateKey({
          description: "The file column's position, from 0, that fills the field; null for none",
          examples: [3],
          messageMissingKey: "Say which column of the file fills the field, or null for none."
        })
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
      payload: DecisionDelta,
      success: S.Struct({
        revision: S.Int.annotateKey({ description: "The draft's revision after this save" })
      }).annotate({ description: "The decisions are saved; the draft's new revision" }),
      error: [Forbidden, ImportNotFound, AlreadyImported]
    })
      .annotate(OpenApi.Summary, "Save the decisions made since the last save")
      .annotate(
        OpenApi.Description,
        "Saves decisions as they are made. Only the difference travels (the rows whose decision is new, and the rows whose decision was taken back), so two screens deciding different rows do not collide. Returns the draft's new revision. Needs the editor role."
      ),
    HttpApiEndpoint.post("commit", "/:id/commit", {
      params: importId,
      payload: DecisionDelta,
      success: ImportView,
      error: [Forbidden, ImportNotFound, AlreadyImported]
    })
      .annotate(OpenApi.Summary, "Confirm: write the items the review says are ready")
      .annotate(
        OpenApi.Description,
        "The confirm carries only the decisions not saved yet; the rows never travel. The server applies the saved draft to the staged file with the same review the screen ran and writes what that says is ready. A confirm of an import already confirmed is refused with 409 instead of running again. Needs the editor role."
      ),
    HttpApiEndpoint.post("takeBack", "/:id/take-back", {
      params: importId,
      payload: S.Struct({
        confirms: S.Array(S.String.check(S.isMaxLength(64)))
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
      success: S.Struct({
        removed: S.Boolean.annotateKey({ description: "True: the import and its saved decisions are gone" })
      }).annotate({ description: "The import was removed" }),
      error: [Forbidden, ImportNotFound, ImportKept]
    })
      .annotate(OpenApi.Summary, "Remove an import nobody has confirmed")
      .annotate(
        OpenApi.Description,
        "Removes an import nobody has confirmed: the staged file and its saved decisions, in one batch with the audit line. One that has created items is kept (409 `ImportKept`); removing again answers 404 `ImportNotFound`, since it is gone. Needs the editor role."
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
 * The edit says something an item cannot be: a name of only spaces, a date that is not a day on the calendar, or
 * discontinued and active at once. Nothing was written; `reason` says which, for the person.
 */
export class ItemInvalid extends S.TaggedError<ItemInvalid, { readonly brand: unique symbol }>()(
  "ItemInvalid",
  { reason: reasonForPerson },
  { description: "The edit says something an item cannot be; nothing was written", httpApiStatus: 422 }
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
        id: S.String.check(S.isMaxLength(64)).annotateKey({
          description: "The item's id, as `items.page` gives it (`id`)"
        })
      },
      payload: ItemEdit,
      success: StoredItem,
      error: [Forbidden, ItemNotFound, ItemChanged, ItemInvalid]
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

/**
 * Everything the browser can call. A request that does not match its Schema gets a 400 problem document listing
 * every field that is wrong at once (`errors: "all"`, `HttpApiMiddleware.ProblemDetails`); a write that did not come
 * from this app's own pages is refused first (`SameOrigin`).
 */
export class Api extends HttpApi.make("inventory")
  .add(SystemApi)
  .add(IdentityApi)
  .add(ActivityApi)
  .add(ImportsApi)
  .add(ItemsApi)
  .add(PeopleApi)
  .add(AssistantApi)
  .middleware(HttpApiMiddleware.ProblemDetails)
  .middleware(SameOrigin)
  .prefix(apiPrefix)
  .annotate(HttpApi.PayloadParseOptions, { errors: "all" })
  .annotate(OpenApi.Title, "Items API")
  // The document's own version, not the path's and not package.json's (each release bumps that): the major is
  // the `v1` of the address, the minor goes up when the contract gains something, the patch when only words change.
  .annotate(OpenApi.Version, "1.0.0")
  // No `OpenApi.Servers`: OpenAPI reads a document without one as served from "/" of whichever host serves it, which
  // is the truth here. Written out as "/", it is joined to every path as "//api/v1/..." on the reference page.
  .annotate(
    OpenApi.Description,
    "The contract the browser calls.\n\n" +
      "**Signing in** is not part of this document: `POST /api/auth/sign-in/email` (Better Auth, with `email` and " +
      "`password` as JSON) sets the session cookie every endpoint here reads, except `GET /identity/session`, which " +
      "answers for nobody too.\n\n" +
      "Each endpoint acts as the signed-in member of their active organization and sees only that organization's " +
      "rows; nothing in a payload can name another member or organization.\n\n" +
      "A write must come from this app's own pages (`Sec-Fetch-Site: same-origin`, or an `Origin` that is the " +
      "app's own). A request with neither header is not from a browser page and is let through to the session check."
  )
  .annotate(OpenApi.Transform, describeDocument) {}
