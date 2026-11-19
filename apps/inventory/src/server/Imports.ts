// Storage for imports: the staged file, what each confirm did with each row, the items it created, and taking a
// confirm back. SQL lives here only; every statement filters on the organization, and goes through a Schema both ways
// (`SqlSchema` for a read, `D1.statement` from @beep/d1 for a write). The rules not to break: a confirm is the only
// statement that adds to `item` (and keeps a copy of each item it replaces, in `importReplaced`), and a take-back the
// only one that deletes from it or puts a replaced item back; each is one atomic batch whose
// every statement checks the same condition (the import is still open; the confirm is still in force), so a second
// press, a retry or another tab writes nothing.
import { Array as Arr, Context, DateTime, Effect, Layer, Option, Order, Record as Rec, Result } from "effect"
import * as S from "effect/Schema"
import { SecureRandom } from "effect/crypto"
import { SqlClient, SqlSchema, type Statement } from "effect/sql"
import {
  ChangedItem,
  ChangeRecord,
  changedItemsShown,
  type DecisionDelta,
  ImportEvent,
  PastImport,
  RowOutcome,
  type TakeBackState
} from "../api/v1/Api.ts"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { type Member } from "@inventory/kernel/Member"
import { Instant } from "@inventory/kernel/Text"
import { type FileProblem, fileProblem } from "../domain/FileProblem.ts"
import {
  Dimensions,
  type ItemFields,
  ItemFields as ItemFieldsSchema,
  skuKey,
  StoredItem,
  Vendor
} from "../domain/Item.ts"
import {
  Change,
  MappingChoice,
  RowDecision,
  type SavedDecisions,
  StagedHead,
  StagedRow,
  type StagedTable
} from "../domain/ItemImport.ts"
import { abandonedAfterMinutes, chunkRows, maxChunkChars } from "../domain/Upload.ts"
import { D1, NoRows } from "@beep/d1/D1"

/** An import as stored, without its rows. */
export const Draft = S.Struct({
  id: S.String,
  fileName: S.String,
  headJson: S.String,
  rowCount: S.Int,
  status: S.Literals(["open", "imported", "takenBack"]),
  actorName: S.String,
  createdAt: Instant,
  importedBy: S.OptionFromNullOr(S.String),
  importedAt: S.OptionFromNullOr(Instant),
  revision: S.Int,
  needsAtStart: S.Int,
  choicesJson: S.String
}).annotate({ description: "An import as stored, without its rows" })
/** The decoded value of `Draft`: an import as stored, without its rows. */
export type Draft = typeof Draft.Type

/** What the commit is told about one item of the file: the review's verdict, and the item when it is ready. */
export type CommitRow = {
  readonly rowNumber: number
  /** Which of its row's items it is: 0 when the row is one item, 1, 2, ... when it holds several. */
  readonly part: number
  readonly sku: string
  readonly name: string
  /** `update`: ready, and it replaces the stored item with its SKU, as the person chose. */
  readonly status: "ready" | "update" | "already" | "notImported"
  readonly reason: string
  readonly decidedBy: "person" | "nobody" | null
  /** Who left the row out, when someone did. */
  readonly decidedByName: string | null
  readonly item: ItemFields | null
  /** The values that differ from the file, for a row that is ready. */
  readonly changes: ReadonlyArray<Change & { readonly decidedByName: string | null }>
}

/** The saved draft of a review, and who last decided each row. */
export type StoredDecisions = {
  readonly decisions: SavedDecisions
  readonly authors: Readonly<Record<string, string>>
}

/** What saving the column choices did: saved them, found them already so (nothing written), or found the import closed. */
export type ChoicesSaved = "saved" | "same" | "closed"

const textOf = (item: ItemFields | null): number =>
  item === null
    ? 0
    : 600 +
      item.name.length +
      Option.getOrElse(item.description, () => "").length +
      Arr.reduce(item.tags, 0, (total, tag) => total + tag.length + 3) +
      Arr.reduce(item.vendors, 0, (total, vendor) => total + vendor.vendorName.length + 120)

/** An upload that has not finished: who started it, what file, and how many rows in how many pieces will follow. */
export const Upload = S.Struct({
  id: S.String,
  fileName: S.String,
  headJson: S.String,
  rowCount: S.Int,
  chunkCount: S.Int
}).annotate({ description: "An unfinished upload, without its pieces" })
/** The decoded value of `Upload`: an upload that has not finished. */
export type Upload = typeof Upload.Type

/**
 * Splits rows into groups for one statement each: at most `chunkRows` rows and about 600,000 characters of text,
 * so the JSON a statement carries stays well under D1's 2 MB limit on a value however long the cells are.
 */
const bySize = <A>(rows: ReadonlyArray<A>, size: (row: A) => number): ReadonlyArray<ReadonlyArray<A>> => {
  const groups: Array<Array<A>> = []
  let current: Array<A> = []
  let weight = 0
  for (const row of rows) {
    const cost = size(row) + 200
    if (current.length > 0 && (current.length >= chunkRows || weight + cost > 600_000)) {
      groups.push(current)
      current = []
      weight = 0
    }
    current.push(row)
    weight += cost
  }
  if (current.length > 0) groups.push(current)
  return groups
}

/**
 * An item as SQLite stores it, decoded by the services that read `item` (here and `Items`): the two switches are 0 or
 * 1, and tags, dimensions and vendors are JSON text, each checked against its Schema on the way out as on the way in.
 */
export const ItemRow = S.Struct({
  ...StoredItem.fields,
  isActive: S.BooleanFromBit,
  lotTracked: S.BooleanFromBit,
  tags: S.String.pipe(S.Array, S.fromJsonString),
  dimensions: Dimensions.pipe(S.fromJsonString, S.OptionFromNullOr),
  vendors: Vendor.pipe(S.Array, S.fromJsonString)
}).annotate({ description: "An item row as SQLite stores it" })

/** The columns of `item` that `ItemRow` reads, in one place for every query that answers items. */
export const itemColumns = (sql: SqlClient.SqlClient) =>
  sql`id, sku, name, description, category, uom, unitCost, quantityOnHand, reorderPoint, isActive, lotTracked, tags,
    firstReceivedOn, discontinuedOn, dimensions, vendors, createdAt, createdBy, revision`

const HeadJson = S.fromJsonString(StagedHead)
const RowsJson = StagedRow.pipe(S.Array, S.fromJsonString)
const DecisionJson = S.fromJsonString(RowDecision)
const ChoicesJson = MappingChoice.pipe(S.Array, S.fromJsonString)
const IdList = S.String.pipe(S.Array, S.fromJsonString).annotate({
  description: "Ids or keys bound as one JSON parameter and read with json_each"
})

const Scope = S.Struct({ org: OrganizationId, id: S.String }).annotate({
  description: "One row of one organization, by id"
})
const Ids = S.Array(S.Struct({ id: S.String })).annotate({ description: "The ids a write returned" })
const Count = S.Array(S.Struct({ n: S.Int })).annotate({ description: "One COUNT(*)" })
/** Who is acting and where: every write is scoped to the actor's organization and names them in the audit line. */
const Acting = { org: OrganizationId, actor: MemberId, name: S.String }

// One decision as it travels to SQL: the row it is for, and the decision as the JSON `importDecision` stores.
const DecisionEntry = S.Struct({ rowId: S.String, json: DecisionJson })
const DecisionEntries = DecisionEntry.pipe(S.Array, S.fromJsonString)

// One item a confirm writes, as it travels to SQL, with the key that makes the SKU unique.
const ItemInsert = S.Struct({
  ...ItemFieldsSchema.fields,
  id: S.String,
  rowNumber: S.Int,
  part: S.Int,
  skuKey: S.String
}).annotate({ description: "An item a confirm writes, as the JSON one statement reads with json_each" })
const ItemInserts = ItemInsert.pipe(S.Array, S.fromJsonString)

// What a confirm items for one item of the file.
const OutcomeInsert = S.Struct({
  rowNumber: S.Int,
  part: S.Int,
  sku: S.String,
  name: S.String,
  status: S.Literals(["ready", "update", "already", "notImported"]),
  reason: S.String,
  decidedBy: S.NullOr(S.Literals(["person", "nobody"])),
  decidedByName: S.NullOr(S.String)
}).annotate({ description: "The review's verdict on one row, before the confirm knows whether its item landed" })
const OutcomeInserts = OutcomeInsert.pipe(S.Array, S.fromJsonString)

// One changed value a confirm items.
const ChangeInsert = S.Struct({
  ...Change.fields,
  rowNumber: S.Int,
  part: S.Int,
  sku: S.String,
  update: S.Boolean,
  decidedByName: S.NullOr(S.String)
}).annotate({ description: "One value a confirm writes that differs from the file" })
const ChangeInserts = ChangeInsert.pipe(S.Array, S.fromJsonString)

const ChangeRow = S.Struct({
  ...ChangeRecord.fields,
  part: S.Int,
  takenBack: S.BooleanFromBit
}).annotate({
  description:
    "A changed value as stored, with its part (0 for a row that is one item) and whether its item was taken back as 0 or 1"
})

// What a confirm stored for one item of the file, its part as stored: 0 for a row that is one item.
const OutcomeRow = S.Struct({ ...RowOutcome.fields, part: S.Int }).annotate({
  description: "What the confirms did with one item of the file, as stored"
})

/** A part as the API says it: left out for a row that is one item (stored as 0), so those answers are as before. */
const partOf = (part: number): { readonly part?: number } => (part === 0 ? {} : { part })

// A confirm as `importBatch` stores it: what it did, and the take-back that reversed it, if one did.
const BatchRow = S.Struct({
  id: S.String,
  confirmedByName: S.String,
  confirmedAt: Instant,
  created: S.Int,
  updated: S.Int,
  already: S.Int,
  notImported: S.Int,
  takenBackByName: S.OptionFromNullOr(S.String),
  takenBackAt: S.OptionFromNullOr(Instant),
  takeBackId: S.NullOr(S.String),
  removed: S.Int,
  restored: S.Int,
  kept: S.Int
}).annotate({ description: "One confirm of an import, and its take-back when there was one" })

const ChangedItemRow = S.Struct({
  sku: S.String,
  name: S.String,
  changedBy: S.OptionFromNullOr(S.String),
  changedAt: S.OptionFromNullOr(Instant)
}).annotate({ description: "An item someone changed after the import, with who and when as stored" })

/** Data access for imports and the items they create. */
export class Imports extends Context.Service<
  Imports,
  {
    /**
     * Starts an upload: stores the file's head and how many rows will follow, and answers its id. A begin with a key
     * the same person already used answers that upload instead of starting a second. Deletes the organization's
     * uploads that were left unfinished for over an hour. A head too large to store is the file's problem, answered
     * as one (`tooLarge`), and nothing is stored.
     */
    beginUpload(
      actor: Member,
      key: string,
      head: StagedHead,
      counts: { readonly rowCount: number; readonly chunkCount: number }
    ): Effect.Effect<Result.Result<string, FileProblem>>
    /** The caller's own unfinished upload with this id. Another member's, or one that finished, is none. */
    findUpload(actor: Member, id: string): Effect.Effect<Option.Option<Upload>>
    /**
     * Stores one piece of an upload. Storing the same piece again stores nothing (the first stays), and a piece for
     * an upload that is gone (cancelled meanwhile) stores nothing either. A piece too large to store is the file's
     * problem, answered as one (`tooLarge`), and nothing is stored.
     */
    putChunk(
      actor: Member,
      upload: Upload,
      seq: number,
      rows: ReadonlyArray<StagedRow>
    ): Effect.Effect<Result.Result<void, FileProblem>>
    /** Every piece of an upload that has arrived, in order. */
    uploadChunks(
      actor: Member,
      upload: Upload
    ): Effect.Effect<ReadonlyArray<{ readonly seq: number; readonly rows: ReadonlyArray<StagedRow> }>>
    /**
     * Turns an upload into an import with the same id, in one batch: the import, its chunks, the audit line, and the
     * upload deleted. Writes no item. Returns false when the upload was gone, in which case nothing was written.
     */
    finishUpload(actor: Member, upload: Upload, needsAtStart: number): Effect.Effect<boolean>
    /** Deletes an unfinished upload and its pieces. Returns false when there was none (finished, or already gone). */
    discardUpload(actor: Member, id: string): Effect.Effect<boolean>
    /** One import of the organization, without its rows. */
    find(organizationId: OrganizationId, id: string): Effect.Effect<Option.Option<Draft>>
    /**
     * The organization's open imports, newest first, at most `limit` of them, and how many are open in all, so the
     * first screen can say how many it left out.
     */
    listOpen(
      organizationId: OrganizationId,
      limit: number
    ): Effect.Effect<{ readonly drafts: ReadonlyArray<Draft>; readonly total: number }>
    /**
     * The organization's imports that were confirmed at least once, last confirmed first, at most `limit`, each
     * with how many items in the system came from it now, and how many such imports there are in all.
     */
    listPast(
      organizationId: OrganizationId,
      limit: number
    ): Effect.Effect<{ readonly imports: ReadonlyArray<PastImport>; readonly total: number }>
    /**
     * Removes an import that has no item in force, with everything that hangs off it (its confirms and what they
     * noted, once every one was taken back), and records who removed it, in one atomic batch. Returns false, having
     * written nothing, when the import is gone, is not open, or still has items: those must stay.
     */
    remove(actor: Member, draft: Draft): Effect.Effect<boolean>
    /** The saved draft: each row's decision, and who made it. */
    decisions(organizationId: OrganizationId, importId: string): Effect.Effect<StoredDecisions>
    /**
     * Saves what changed in the draft, row by row, under the member's name, and answers the draft's revision. A
     * delta that changes nothing (the same save sent again) writes nothing and leaves the revision as it is. None when
     * the import is no longer open (nothing is saved then).
     */
    decide(actor: Member, draft: Draft, delta: DecisionDelta): Effect.Effect<Option.Option<number>>
    /** The columns people chose for fields, as stored with the draft. */
    choices(draft: Draft): Effect.Effect<ReadonlyArray<MappingChoice>>
    /**
     * Points fields at file columns (or at none), with its audit line. Choices that are already so write nothing,
     * and an import that is no longer open writes nothing either.
     */
    setChoices(
      actor: Member,
      draft: Draft,
      choices: ReadonlyArray<MappingChoice>,
      detail: string
    ): Effect.Effect<ChoicesSaved>
    /**
     * The items of the file an earlier confirm of this import created and still has, by row and part (0 when the
     * row is one item).
     */
    createdRows(
      organizationId: OrganizationId,
      importId: string
    ): Effect.Effect<ReadonlyArray<{ readonly rowNumber: number; readonly part: number }>>
    /**
     * Replaces the stored decision of rows that already have one, keeping who made them. Used when the app itself
     * has to take back an acceptance (the proposal behind it changed), which is not a decision by the person acting.
     */
    rewriteDecisions(actor: Member, draft: Draft, set: SavedDecisions): Effect.Effect<void>
    /**
     * Opens a confirmed or taken-back import again for its rows to be decided. Items it created and still has are
     * untouched. Opening one that is open already writes nothing.
     */
    reopen(actor: Member, draft: Draft): Effect.Effect<void>
    /** Every changed value the organization's imports wrote, newest import first. */
    changes(organizationId: OrganizationId): Effect.Effect<ReadonlyArray<ChangeRecord>>
    /** The staged file, rows included, exactly as it was sent. */
    table(organizationId: OrganizationId, draft: Draft): Effect.Effect<StagedTable>
    /** The organization's items under these SKU keys. Never another organization's items. */
    storedAmong(organizationId: OrganizationId, keys: ReadonlyArray<string>): Effect.Effect<ReadonlyArray<StoredItem>>
    /**
     * What the form-only rules changed in the rows this import wrote, counted from the changed values its confirms
     * stored: how many rows, and how many values.
     */
    fixed(
      organizationId: OrganizationId,
      importId: string
    ): Effect.Effect<{ readonly rows: number; readonly cells: number }>
    /**
     * Items a confirm and writes its ready items, each row's outcome, the changed values and the audit line, in
     * one atomic batch. Returns false when the import was no longer open, in which case nothing was written.
     */
    commit(actor: Member, draft: Draft, rows: ReadonlyArray<CommitRow>): Effect.Effect<boolean>
    /**
     * Takes back the import's confirms named in `confirms` that are still in force, in one atomic batch: removes
     * their items that nobody has changed since (revision 1), puts back the stored items they replaced that nobody
     * has changed since (from the copy each replace kept), keeps the ones someone changed, marks the rows of the
     * removed and restored items, records who took them back with the counts, and writes the audit line. Returns false, having
     * written nothing, when none of those confirms is in force any more (taken back already: a second press).
     */
    takeBack(actor: Member, draft: Draft, confirms: ReadonlyArray<string>): Effect.Effect<boolean>
    /** Every confirm and take-back of the import, oldest first, with the numbers they stored. */
    history(organizationId: OrganizationId, importId: string): Effect.Effect<ReadonlyArray<ImportEvent>>
    /** What taking the import back would do now, read from the items and confirms as stored. */
    takeBackState(organizationId: OrganizationId, importId: string): Effect.Effect<TakeBackState>
    /** What the confirms did with each row of the file, by row. */
    outcomes(organizationId: OrganizationId, importId: string): Effect.Effect<ReadonlyArray<RowOutcome>>
    /** Every item of the organization, by SKU. */
    items(organizationId: OrganizationId): Effect.Effect<ReadonlyArray<StoredItem>>
  }
>()("@inventory/app/server/Imports") {
  static readonly layer = Layer.effect(
    Imports,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const d1 = yield* D1
      const { batch, run } = d1
      const random = yield* SecureRandom.SecureRandom
      const now = DateTime.now.pipe(Effect.map(DateTime.formatIso))
      const acting = (actor: Member) => ({ org: actor.organizationId, actor: actor.id, name: actor.name })

      // -- Reads ---------------------------------------------------------------------------------------------------

      const draftColumns = sql`id, fileName, headJson, rowCount, status, actorName, createdAt, importedBy, importedAt,
        revision, needsAtStart, choicesJson`
      const findDraft = SqlSchema.findOneOption({
        Request: Scope,
        Result: Draft,
        execute: ({ org, id }) =>
          sql`SELECT ${draftColumns} FROM importDraft WHERE organizationId = ${org} AND id = ${id}`
      })
      const findOpen = SqlSchema.findAll({
        Request: S.Struct({ org: OrganizationId, limit: S.Int }),
        Result: Draft,
        execute: ({ org, limit }) =>
          sql`SELECT ${draftColumns} FROM importDraft WHERE organizationId = ${org} AND status = 'open'
            ORDER BY createdAt DESC, rowid DESC LIMIT ${limit}`
      })
      const countOpen = SqlSchema.findOne({
        Request: OrganizationId,
        Result: S.Struct({ n: S.Int }),
        execute: (org) => sql`SELECT COUNT(*) AS n FROM importDraft WHERE organizationId = ${org} AND status = 'open'`
      })
      const findDecisions = SqlSchema.findAll({
        Request: Scope,
        Result: S.Struct({ rowId: S.String, decisionJson: S.String, decidedByName: S.String }),
        execute: ({ org, id }) =>
          sql`SELECT rowId, decisionJson, decidedByName FROM importDecision
            WHERE organizationId = ${org} AND importId = ${id}`
      })
      // A value counts as taken back when its confirm was taken back and the item it went into is gone with it, or,
      // for a replace, was put back as it was; an item that was kept because someone had changed it still holds it.
      const findChanges = SqlSchema.findAll({
        Request: OrganizationId,
        Result: ChangeRow,
        execute: (org) =>
          sql`SELECT c.importId, d.fileName, c.rowNumber, c.sku, c.field, c.fromValue AS "from", c.toValue AS "to",
              c.source, c.decidedBy, c.decidedByName, c.how, c.basis, c.confidence, c.createdAt,
              c.part, (b.takeBackId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM item i
                WHERE i.organizationId = c.organizationId AND i.batchId = c.batchId AND i.sourceRow = c.rowNumber
                  AND i.sourcePart = c.part)
                AND NOT EXISTS (SELECT 1 FROM importReplaced p
                  WHERE p.organizationId = c.organizationId AND p.batchId = c.batchId AND p.sourceRow = c.rowNumber
                    AND p.sourcePart = c.part AND p.restored = 0)) AS takenBack
            FROM importChange c
            JOIN importDraft d ON d.organizationId = c.organizationId AND d.id = c.importId
            JOIN importBatch b ON b.organizationId = c.organizationId AND b.id = c.batchId
            WHERE c.organizationId = ${org} ORDER BY c.createdAt DESC, c.rowNumber, c.part, c.field LIMIT 5000`
      })
      const findChunks = SqlSchema.findAll({
        Request: Scope,
        Result: S.Struct({ rowsJson: S.String }),
        execute: ({ org, id }) =>
          sql`SELECT rowsJson FROM importChunk WHERE organizationId = ${org} AND importId = ${id} ORDER BY seq`
      })
      const findOutcomes = SqlSchema.findAll({
        Request: Scope,
        Result: OutcomeRow,
        execute: ({ org, id }) =>
          sql`SELECT rowNumber, part, sku, name, outcome, reason, decidedBy, decidedByName FROM importOutcome
            WHERE organizationId = ${org} AND importId = ${id} ORDER BY rowNumber, part`
      })
      const findItems = SqlSchema.findAll({
        Request: OrganizationId,
        Result: ItemRow,
        execute: (org) => sql`SELECT ${itemColumns(sql)} FROM item WHERE organizationId = ${org} ORDER BY sku`
      })
      const findCreatedRows = SqlSchema.findAll({
        Request: Scope,
        Result: S.Struct({ rowNumber: S.Int, part: S.Int }),
        execute: ({ org, id }) =>
          sql`SELECT rowNumber, part FROM importOutcome
            WHERE organizationId = ${org} AND importId = ${id} AND outcome = 'created' ORDER BY rowNumber, part`
      })
      const findStored = SqlSchema.findAll({
        Request: S.Struct({ org: OrganizationId, keys: IdList }),
        Result: ItemRow,
        execute: ({ org, keys }) =>
          sql`SELECT ${itemColumns(sql)} FROM item WHERE organizationId = ${org}
            AND skuKey IN (SELECT value FROM json_each(${keys}))`
      })
      const findBatches = SqlSchema.findAll({
        Request: Scope,
        Result: BatchRow,
        execute: ({ org, id }) =>
          sql`SELECT id, confirmedByName, confirmedAt, created, updated, already, notImported, takenBackByName, takenBackAt,
              takeBackId, removed, restored, kept
            FROM importBatch WHERE organizationId = ${org} AND importId = ${id} ORDER BY confirmedAt, rowid`
      })
      const findUploadRow = SqlSchema.findOneOption({
        Request: S.Struct({ org: OrganizationId, actor: MemberId, id: S.String }),
        Result: Upload,
        execute: ({ org, actor, id }) =>
          sql`SELECT id, fileName, headJson, rowCount, chunkCount FROM importUpload
            WHERE organizationId = ${org} AND id = ${id} AND actorId = ${actor}`
      })
      const findUploadByKey = SqlSchema.findOne({
        Request: S.Struct({ org: OrganizationId, actor: MemberId, key: S.String }),
        Result: S.Struct({ id: S.String }),
        execute: ({ org, actor, key }) =>
          sql`SELECT id FROM importUpload WHERE organizationId = ${org} AND actorId = ${actor} AND requestKey = ${key}`
      })
      const findUploadChunks = SqlSchema.findAll({
        Request: Scope,
        Result: S.Struct({ seq: S.Int, rowsJson: S.String }),
        execute: ({ org, id }) =>
          sql`SELECT seq, rowsJson FROM importUploadChunk WHERE organizationId = ${org} AND uploadId = ${id}
            ORDER BY seq`
      })

      // -- Guards every write of a batch shares ----------------------------------------------------------------

      const stillOpen = (org: string, id: string) => sql`EXISTS (SELECT 1 FROM importDraft
        WHERE organizationId = ${org} AND id = ${id} AND status = 'open')`
      const stillUploading = (org: string, actor: string, id: string) => sql`EXISTS (SELECT 1 FROM importUpload
        WHERE organizationId = ${org} AND id = ${id} AND actorId = ${actor})`

      // -- Uploads ---------------------------------------------------------------------------------------------

      const UploadScope = S.Struct({ org: OrganizationId, actor: MemberId, id: S.String })
      const dropAbandonedChunks = D1.statement({
        Request: S.Struct({ org: OrganizationId, before: S.String }),
        Result: NoRows,
        execute: (r) => sql`DELETE FROM importUploadChunk WHERE organizationId = ${r.org}
          AND uploadId IN (SELECT id FROM importUpload WHERE organizationId = ${r.org} AND createdAt < ${r.before})`
      })
      const dropAbandonedUploads = D1.statement({
        Request: S.Struct({ org: OrganizationId, before: S.String }),
        Result: NoRows,
        execute: (r) => sql`DELETE FROM importUpload WHERE organizationId = ${r.org} AND createdAt < ${r.before}`
      })
      const insertUpload = D1.statement({
        Request: S.Struct({
          ...Acting,
          id: S.String,
          key: S.String,
          fileName: S.String,
          headJson: HeadJson,
          rowCount: S.Int,
          chunkCount: S.Int,
          at: S.String
        }),
        Result: NoRows,
        execute: (r) => sql`INSERT INTO importUpload (id, organizationId, actorId, actorName, requestKey, fileName,
            headJson, rowCount, chunkCount, createdAt)
          VALUES (${r.id}, ${r.org}, ${r.actor}, ${r.name}, ${r.key}, ${r.fileName}, ${r.headJson}, ${r.rowCount},
            ${r.chunkCount}, ${r.at})
          ON CONFLICT (organizationId, actorId, requestKey) DO NOTHING`
      })

      const beginUpload = Effect.fn("Imports.beginUpload")(function* (
        actor: Member,
        key: string,
        head: StagedHead,
        counts: { readonly rowCount: number; readonly chunkCount: number }
      ) {
        const id = yield* random.uuidV4()
        const now = yield* DateTime.now
        const at = DateTime.formatIso(now)
        const before = DateTime.formatIso(DateTime.subtract(now, { minutes: abandonedAfterMinutes }))
        const headJson = yield* S.encodeEffect(HeadJson)(head).pipe(Effect.orDie)
        // D1 refuses a value over 2 MB. Say so in words before it does.
        if (headJson.length > maxChunkChars) {
          return Result.fail(fileProblem.tooLong({ fileName: head.fileName, part: "headings" }))
        }
        const org = actor.organizationId
        yield* batch([
          dropAbandonedChunks({ org, before }),
          dropAbandonedUploads({ org, before }),
          insertUpload({ ...acting(actor), id, key, fileName: head.fileName, headJson: head, ...counts, at })
        ]).pipe(Effect.orDie)
        // The upload this key started: the one just written, or the one an earlier begin with the same key wrote.
        const started = yield* findUploadByKey({ org, actor: actor.id, key }).pipe(Effect.orDie)
        return Result.succeed(started.id)
      })

      const insertChunk = D1.statement({
        Request: S.Struct({
          ...UploadScope.fields,
          seq: S.Int,
          rowCount: S.Int,
          rows: RowsJson
        }),
        Result: NoRows,
        // The first copy of a piece stays: a retry carries the same rows, and a different second copy would be a
        // client mistake that must not replace rows already counted.
        execute: (r) => sql`INSERT INTO importUploadChunk (uploadId, organizationId, seq, rowCount, rowsJson)
          SELECT ${r.id}, ${r.org}, ${r.seq}, ${r.rowCount}, ${r.rows}
          WHERE ${stillUploading(r.org, r.actor, r.id)}
          ON CONFLICT (organizationId, uploadId, seq) DO NOTHING`
      })

      const putChunk = Effect.fn("Imports.putChunk")(function* (
        actor: Member,
        upload: Upload,
        seq: number,
        rows: ReadonlyArray<StagedRow>
      ) {
        const json = yield* S.encodeEffect(RowsJson)(rows)
        if (json.length > maxChunkChars) {
          return Result.fail(fileProblem.tooLong({ fileName: upload.fileName, part: "cells" }))
        }
        yield* run(
          insertChunk({ org: actor.organizationId, actor: actor.id, id: upload.id, seq, rowCount: rows.length, rows })
        )
        return Result.succeed(undefined)
      }, Effect.orDie)

      const uploadChunks = Effect.fn("Imports.uploadChunks")(function* (actor: Member, upload: Upload) {
        const chunks = yield* findUploadChunks({ org: actor.organizationId, id: upload.id })
        return yield* Effect.forEach(
          chunks,
          (chunk) => Effect.map(S.decodeEffect(RowsJson)(chunk.rowsJson), (rows) => ({ seq: chunk.seq, rows })),
          { concurrency: 1 }
        )
      }, Effect.orDie)

      const draftFromUpload = D1.statement({
        Request: S.Struct({ ...UploadScope.fields, at: S.String, needsAtStart: S.Int }),
        Result: NoRows,
        execute: (r) => sql`INSERT INTO importDraft (id, organizationId, actorId, actorName, fileName, headJson,
            rowCount, status, createdAt, needsAtStart)
          SELECT id, organizationId, actorId, actorName, fileName, headJson, rowCount, 'open', ${r.at}, ${r.needsAtStart}
          FROM importUpload WHERE organizationId = ${r.org} AND id = ${r.id} AND actorId = ${r.actor}`
      })
      const chunksFromUpload = D1.statement({
        Request: UploadScope,
        Result: NoRows,
        execute: (r) => sql`INSERT INTO importChunk (importId, organizationId, seq, rowsJson)
          SELECT uploadId, organizationId, seq, rowsJson FROM importUploadChunk
          WHERE organizationId = ${r.org} AND uploadId = ${r.id} AND ${stillUploading(r.org, r.actor, r.id)}`
      })
      const uploadedLine = D1.statement({
        Request: S.Struct({
          ...Acting,
          upload: S.String,
          activity: S.String,
          detail: S.String,
          at: S.String
        }),
        Result: NoRows,
        execute: (r) => sql`INSERT INTO activity (id, organizationId, actorId, actorName, action, detail, createdAt)
          SELECT ${r.activity}, ${r.org}, ${r.actor}, ${r.name}, 'Uploaded a file', ${r.detail}, ${r.at}
          WHERE ${stillUploading(r.org, r.actor, r.upload)}`
      })
      const dropUploadChunks = D1.statement({
        Request: UploadScope,
        Result: NoRows,
        execute: (r) => sql`DELETE FROM importUploadChunk WHERE organizationId = ${r.org} AND uploadId = ${r.id}
          AND ${stillUploading(r.org, r.actor, r.id)}`
      })
      const dropUpload = D1.statement({
        Request: UploadScope,
        Result: Ids,
        execute: (r) => sql`DELETE FROM importUpload
          WHERE organizationId = ${r.org} AND id = ${r.id} AND actorId = ${r.actor} RETURNING id`
      })

      const finishUpload = Effect.fn("Imports.finishUpload")(function* (
        actor: Member,
        upload: Upload,
        needsAtStart: number
      ) {
        const activity = yield* random.uuidV4()
        const at = yield* now
        const scope = { org: actor.organizationId, actor: actor.id, id: upload.id }
        const [, , , , dropped] = yield* batch([
          draftFromUpload({ ...scope, at, needsAtStart }),
          chunksFromUpload(scope),
          uploadedLine({
            ...acting(actor),
            upload: upload.id,
            activity,
            detail: `${upload.fileName}: ${upload.rowCount} rows staged, nothing imported yet`,
            at
          }),
          dropUploadChunks(scope),
          dropUpload(scope)
        ]).pipe(Effect.orDie)
        // The last statement returns the upload's id only when this batch was the one that finished it.
        return dropped.length > 0
      })

      const discardUpload = Effect.fn("Imports.discardUpload")(function* (actor: Member, id: string) {
        const scope = { org: actor.organizationId, actor: actor.id, id }
        const [, dropped] = yield* batch([dropUploadChunks(scope), dropUpload(scope)]).pipe(Effect.orDie)
        return dropped.length > 0
      })

      // -- The staged file and its draft ---------------------------------------------------------------------

      const table = Effect.fn("Imports.table")(function* (organizationId: OrganizationId, draft: Draft) {
        const head = yield* S.decodeEffect(HeadJson)(draft.headJson)
        const chunks = yield* findChunks({ org: organizationId, id: draft.id })
        const rows = yield* Effect.forEach(chunks, (chunk) => S.decodeEffect(RowsJson)(chunk.rowsJson), {
          concurrency: 1
        })
        return { ...head, rows: Arr.flatten(rows) }
      }, Effect.orDie)

      const decisions = Effect.fn("Imports.decisions")(function* (organizationId: OrganizationId, importId: string) {
        const rows = yield* findDecisions({ org: organizationId, id: importId })
        const decoded = yield* Effect.forEach(
          rows,
          (row) =>
            Effect.map(S.decodeEffect(DecisionJson)(row.decisionJson), (decision) => [row.rowId, decision] as const),
          { concurrency: 1 }
        )
        return {
          decisions: Rec.fromEntries(decoded),
          authors: Rec.fromEntries(Arr.map(rows, (row) => [row.rowId, row.decidedByName] as const))
        }
      }, Effect.orDie)

      // A decision differs from what is stored when the row has none yet, or a different one.
      const differs = (org: string, id: string, entries: string) => sql`EXISTS (SELECT 1 FROM json_each(${entries}) j
        WHERE NOT EXISTS (SELECT 1 FROM importDecision d WHERE d.organizationId = ${org} AND d.importId = ${id}
          AND d.rowId = json_extract(j.value, '$.rowId') AND d.decisionJson = json_extract(j.value, '$.json')))`
      const clears = (org: string, id: string, rowIds: string) => sql`EXISTS (SELECT 1 FROM importDecision
        WHERE organizationId = ${org} AND importId = ${id} AND rowId IN (SELECT value FROM json_each(${rowIds})))`
      const DeltaRequest = S.Struct({
        org: OrganizationId,
        id: S.String,
        sets: S.Array(DecisionEntries),
        clears: S.Array(IdList)
      })
      // Bumps the revision only when the delta changes something, before the writes below make it true.
      const bumpRevision = D1.statement({
        Request: DeltaRequest,
        Result: NoRows,
        execute: (r) => {
          const changes: ReadonlyArray<Statement.Fragment> = [
            ...Arr.map(r.sets, (entries) => differs(r.org, r.id, entries)),
            ...Arr.map(r.clears, (rowIds) => clears(r.org, r.id, rowIds))
          ]
          return sql`UPDATE importDraft SET revision = revision + 1
            WHERE organizationId = ${r.org} AND id = ${r.id} AND status = 'open' AND (${sql.or(changes)})`
        }
      })
      const upsertDecisions = D1.statement({
        Request: S.Struct({ ...Acting, id: S.String, entries: DecisionEntries, at: S.String }),
        Result: NoRows,
        // The same decision sent again leaves the row (and who made it) as it is.
        execute: (r) => sql`INSERT INTO importDecision (importId, organizationId, rowId, decisionJson, decidedById,
            decidedByName, updatedAt)
          SELECT ${r.id}, ${r.org}, json_extract(value, '$.rowId'), json_extract(value, '$.json'), ${r.actor}, ${r.name},
            ${r.at}
          FROM json_each(${r.entries}) WHERE ${stillOpen(r.org, r.id)}
          ON CONFLICT (organizationId, importId, rowId) DO UPDATE SET decisionJson = excluded.decisionJson,
            decidedById = excluded.decidedById, decidedByName = excluded.decidedByName, updatedAt = excluded.updatedAt
          WHERE importDecision.decisionJson IS NOT excluded.decisionJson`
      })
      const clearDecisions = D1.statement({
        Request: S.Struct({ org: OrganizationId, id: S.String, rowIds: IdList }),
        Result: NoRows,
        execute: (r) => sql`DELETE FROM importDecision WHERE organizationId = ${r.org} AND importId = ${r.id}
          AND rowId IN (SELECT value FROM json_each(${r.rowIds})) AND ${stillOpen(r.org, r.id)}`
      })
      const openRevision = D1.statement({
        Request: Scope,
        Result: S.Array(S.Struct({ revision: S.Int })),
        execute: (r) => sql`SELECT revision FROM importDraft
          WHERE organizationId = ${r.org} AND id = ${r.id} AND status = 'open'`
      })

      const decide = Effect.fn("Imports.decide")(function* (actor: Member, draft: Draft, delta: DecisionDelta) {
        const at = yield* now
        const org = actor.organizationId
        const sets = Arr.chunksOf(
          Arr.map(Rec.toEntries(delta.set), ([rowId, json]) => ({ rowId, json })),
          2000
        )
        const cleared = Arr.chunksOf(delta.clear, 5000)
        if (sets.length + cleared.length === 0) {
          const open = yield* run(openRevision({ org, id: draft.id }))
          return Option.map(Arr.head(open), (row) => row.revision)
        }
        // The revision moves first, and only for a delta that changes something; read right after it, it is the
        // revision these decisions are saved under. The writes after it change no revision.
        const [, revision] = yield* batch([
          bumpRevision({ org, id: draft.id, sets, clears: cleared }),
          openRevision({ org, id: draft.id }),
          ...Arr.map(sets, (entries) => upsertDecisions({ ...acting(actor), id: draft.id, entries, at })),
          ...Arr.map(cleared, (rowIds) => clearDecisions({ org, id: draft.id, rowIds }))
        ])
        return Option.map(Arr.head(revision), (row) => row.revision)
      }, Effect.orDie)

      const ReopenRequest = S.Struct({
        ...Acting,
        id: S.String,
        activity: S.String,
        detail: S.String,
        at: S.String
      })
      const reopenedLine = D1.statement({
        Request: ReopenRequest,
        Result: NoRows,
        execute: (r) => sql`INSERT INTO activity (id, organizationId, actorId, actorName, action, detail, createdAt)
          SELECT ${r.activity}, ${r.org}, ${r.actor}, ${r.name}, 'Reopened an import', ${r.detail}, ${r.at}
          WHERE EXISTS (SELECT 1 FROM importDraft
            WHERE organizationId = ${r.org} AND id = ${r.id} AND status IN ('imported', 'takenBack'))`
      })
      const reopenDraft = D1.statement({
        Request: Scope,
        Result: NoRows,
        execute: (r) => sql`UPDATE importDraft SET status = 'open', revision = revision + 1
          WHERE organizationId = ${r.org} AND id = ${r.id} AND status IN ('imported', 'takenBack')`
      })

      const reopen = Effect.fn("Imports.reopen")(function* (actor: Member, draft: Draft) {
        const at = yield* now
        const activity = yield* random.uuidV4()
        const detail =
          draft.status === "takenBack"
            ? `${draft.fileName}: to review again after it was taken back`
            : `${draft.fileName}: to fix the rows that were not imported`
        yield* batch([
          reopenedLine({ ...acting(actor), id: draft.id, activity, detail, at }),
          reopenDraft({ org: actor.organizationId, id: draft.id })
        ])
      }, Effect.orDie)

      const listOpen = Effect.fn("Imports.listOpen")(function* (organizationId: OrganizationId, limit: number) {
        const drafts = yield* findOpen({ org: organizationId, limit })
        const total = yield* countOpen(organizationId)
        return { drafts, total: total.n }
      }, Effect.orDie)

      // Each import with at least one confirm, by its last one. Its items are counted from the item table, so a
      // take-back or a later edit shows as it is stored, not as the confirm once said.
      const findPast = SqlSchema.findAll({
        Request: S.Struct({ org: OrganizationId, limit: S.Int }),
        Result: PastImport,
        execute: ({ org, limit }) =>
          sql`SELECT d.id, d.fileName, d.rowCount, d.status, b.confirmedByName, b.confirmedAt, b.notImported,
              (SELECT COUNT(*) FROM item i WHERE i.organizationId = d.organizationId AND i.importId = d.id) AS items
            FROM importDraft d
            JOIN importBatch b ON b.organizationId = d.organizationId AND b.importId = d.id
            WHERE d.organizationId = ${org}
              AND b.rowid = (SELECT x.rowid FROM importBatch x
                WHERE x.organizationId = d.organizationId AND x.importId = d.id
                ORDER BY x.confirmedAt DESC, x.rowid DESC LIMIT 1)
            ORDER BY b.confirmedAt DESC, b.rowid DESC LIMIT ${limit}`
      })
      const countPast = SqlSchema.findOne({
        Request: OrganizationId,
        Result: S.Struct({ n: S.Int }),
        execute: (org) => sql`SELECT COUNT(DISTINCT importId) AS n FROM importBatch WHERE organizationId = ${org}`
      })
      const listPast = Effect.fn("Imports.listPast")(function* (organizationId: OrganizationId, limit: number) {
        const imports = yield* findPast({ org: organizationId, limit })
        const total = yield* countPast(organizationId)
        return { imports, total: total.n }
      }, Effect.orDie)

      // -- Removing an import nobody needs --------------------------------------------------------------------

      // An import may be removed while it is open and has no item in force: never confirmed, or every confirm taken
      // back with nothing kept. Its items, if any, would point at it (and the foreign key would refuse anyway).
      // A replace still in force keeps it too: its copy of the item as it was is what a take-back puts back.
      const removable = (org: string, id: string) => sql`(${stillOpen(org, id)}
        AND NOT EXISTS (SELECT 1 FROM item WHERE organizationId = ${org} AND importId = ${id})
        AND NOT EXISTS (SELECT 1 FROM importReplaced p JOIN importBatch b
            ON b.organizationId = p.organizationId AND b.id = p.batchId
          WHERE p.organizationId = ${org} AND p.importId = ${id} AND b.takeBackId IS NULL))`
      const RemoveRequest = S.Struct({
        ...Acting,
        id: S.String,
        activity: S.String,
        detail: S.String,
        at: S.String
      })
      const removedLine = D1.statement({
        Request: RemoveRequest,
        Result: NoRows,
        execute: (r) => sql`INSERT INTO activity (id, organizationId, actorId, actorName, action, detail, createdAt)
          SELECT ${r.activity}, ${r.org}, ${r.actor}, ${r.name}, 'Removed an import', ${r.detail}, ${r.at}
          WHERE ${removable(r.org, r.id)}`
      })
      // The children in the order their foreign keys need, each under the same condition, the import last.
      const removeFrom = (from: Statement.Fragment) =>
        D1.statement({
          Request: Scope,
          Result: NoRows,
          execute: (r) => sql`DELETE FROM ${from} WHERE organizationId = ${r.org} AND importId = ${r.id}
            AND ${removable(r.org, r.id)}`
        })
      const removeDraft = D1.statement({
        Request: Scope,
        Result: Ids,
        execute: (r) => sql`DELETE FROM importDraft WHERE organizationId = ${r.org} AND id = ${r.id}
          AND ${removable(r.org, r.id)} RETURNING id`
      })

      const remove = Effect.fn("Imports.remove")(function* (actor: Member, draft: Draft) {
        const at = yield* now
        const activity = yield* random.uuidV4()
        const scope = { org: actor.organizationId, id: draft.id }
        const rows = `${draft.rowCount} ${draft.rowCount === 1 ? "row" : "rows"}`
        // Every statement checks the same thing, so a retry, a second tab or a confirm landing in between writes
        // nothing twice and never deletes an import whose items are in the system. D1 has no interactive transaction,
        // so the audit line is written first, while the check can still be true, and the import last.
        const answers = yield* batch([
          removedLine({
            ...acting(actor),
            id: draft.id,
            activity,
            detail: `${draft.fileName}: ${rows}, ${Option.isNone(draft.importedAt) ? "nothing had been imported" : "every item it created had been taken back"}`,
            at
          }),
          removeFrom(sql`importSuggestion`)(scope),
          removeFrom(sql`importDecision`)(scope),
          removeFrom(sql`importChunk`)(scope),
          removeFrom(sql`importChange`)(scope),
          removeFrom(sql`importOutcome`)(scope),
          removeFrom(sql`importReplaced`)(scope),
          removeFrom(sql`importBatch`)(scope),
          removeDraft(scope)
        ])
        // The last statement returns the import's id only when this batch was the one that removed it.
        return Option.isSome(Arr.last(answers[8]))
      }, Effect.orDie)

      // -- Columns ---------------------------------------------------------------------------------------------------

      const choices = Effect.fn("Imports.choices")(function* (draft: Draft) {
        return yield* S.decodeEffect(ChoicesJson)(draft.choicesJson)
      }, Effect.orDie)

      const ChoicesRequest = S.Struct({
        ...Acting,
        id: S.String,
        choices: ChoicesJson,
        activity: S.String,
        detail: S.String,
        at: S.String
      })
      // Choices that are already so are not a change: no audit line and no new revision.
      const choicesDiffer = (r: { readonly org: string; readonly id: string; readonly choices: string }) =>
        sql`EXISTS (SELECT 1 FROM importDraft WHERE organizationId = ${r.org} AND id = ${r.id} AND status = 'open'
          AND choicesJson IS NOT ${r.choices})`
      const matchedLine = D1.statement({
        Request: ChoicesRequest,
        Result: NoRows,
        execute: (r) => sql`INSERT INTO activity (id, organizationId, actorId, actorName, action, detail, createdAt)
          SELECT ${r.activity}, ${r.org}, ${r.actor}, ${r.name}, 'Matched a column', ${r.detail}, ${r.at}
          WHERE ${choicesDiffer(r)}`
      })
      const saveChoices = D1.statement({
        Request: ChoicesRequest,
        Result: Ids,
        execute: (r) => sql`UPDATE importDraft SET choicesJson = ${r.choices}, revision = revision + 1
          WHERE organizationId = ${r.org} AND id = ${r.id} AND status = 'open' AND choicesJson IS NOT ${r.choices}
          RETURNING id`
      })

      const setChoices = Effect.fn("Imports.setChoices")(function* (
        actor: Member,
        draft: Draft,
        list: ReadonlyArray<MappingChoice>,
        detail: string
      ) {
        const at = yield* now
        const activity = yield* random.uuidV4()
        const request = { ...acting(actor), id: draft.id, choices: list, activity, detail, at }
        const [, saved, open] = yield* batch([
          matchedLine(request),
          saveChoices(request),
          openRevision({ org: actor.organizationId, id: draft.id })
        ])
        return saved.length > 0 ? ("saved" as const) : open.length > 0 ? ("same" as const) : ("closed" as const)
      }, Effect.orDie)

      const createdRows = Effect.fn("Imports.createdRows")(function* (
        organizationId: OrganizationId,
        importId: string
      ) {
        return yield* findCreatedRows({ org: organizationId, id: importId })
      }, Effect.orDie)

      // One pass over the list, each entry finding its stored row by the primary key: an upsert that only ever
      // updates, since it reads only rows that exist, and keeps who decided each. `CROSS JOIN` keeps the list on the
      // outside; an UPDATE that looks each row up in the list reads the whole list once per row.
      const rewriteRows = D1.statement({
        Request: S.Struct({ org: OrganizationId, id: S.String, entries: DecisionEntries }),
        Result: NoRows,
        execute: (r) => sql`INSERT INTO importDecision
            (organizationId, importId, rowId, decisionJson, decidedById, decidedByName, updatedAt)
          SELECT d.organizationId, d.importId, d.rowId, json_extract(j.value, '$.json'),
            d.decidedById, d.decidedByName, d.updatedAt
          FROM json_each(${r.entries}) AS j
          CROSS JOIN importDecision d
            ON d.organizationId = ${r.org} AND d.importId = ${r.id} AND d.rowId = json_extract(j.value, '$.rowId')
          WHERE true
          ON CONFLICT (organizationId, importId, rowId) DO UPDATE SET decisionJson = excluded.decisionJson`
      })
      const bumpOpen = D1.statement({
        Request: Scope,
        Result: NoRows,
        execute: (r) => sql`UPDATE importDraft SET revision = revision + 1
          WHERE organizationId = ${r.org} AND id = ${r.id} AND status = 'open'`
      })

      const rewriteDecisions = Effect.fn("Imports.rewriteDecisions")(function* (
        actor: Member,
        draft: Draft,
        set: SavedDecisions
      ) {
        const entries = Arr.map(Rec.toEntries(set), ([rowId, json]) => ({ rowId, json }))
        if (entries.length === 0) return
        const org = actor.organizationId
        const chunks = Arr.chunksOf(entries, 2000)
        // One atomic batch: every chunk and the new revision land together, or none of them does.
        yield* batch([
          ...Arr.map(chunks, (chunk) => rewriteRows({ org, id: draft.id, entries: chunk })),
          bumpOpen({ org, id: draft.id })
        ])
      }, Effect.orDie)

      const storedAmong = Effect.fn("Imports.storedAmong")(function* (
        organizationId: OrganizationId,
        keys: ReadonlyArray<string>
      ) {
        // The keys travel as one JSON value per 5,000, so the statement never nears D1's 100 bound parameters.
        const found = yield* Effect.forEach(
          Arr.chunksOf(keys, 5000),
          (some) => findStored({ org: organizationId, keys: some }),
          { concurrency: 1 }
        )
        return Arr.flatten(found)
      }, Effect.orDie)

      const findFixed = SqlSchema.findOne({
        Request: Scope,
        Result: S.Struct({ rows: S.Int, cells: S.Int }),
        execute: ({ org, id }) =>
          sql`SELECT COUNT(DISTINCT c.rowNumber || '.' || c.part) AS rows, COUNT(*) AS cells FROM importChange c
            JOIN importOutcome o ON o.organizationId = c.organizationId AND o.importId = c.importId
              AND o.rowNumber = c.rowNumber AND o.part = c.part
            WHERE c.organizationId = ${org} AND c.importId = ${id} AND c.how = 'applied by a rule'
              AND o.outcome IN ('created', 'updated')`
      })

      // -- The confirm ---------------------------------------------------------------------------------------

      const CommitScope = S.Struct({ ...Acting, id: S.String, batch: S.String, at: S.String })
      // The confirm's own row is written first and only while the import is open; the import is closed next. Every
      // statement after them checks that this confirm's row exists, so a second confirm (a double click, a retry,
      // another tab) finds the import closed, writes no row of its own, and so writes nothing at all.
      const insertBatch = D1.statement({
        Request: CommitScope,
        Result: Ids,
        execute: (r) => sql`INSERT INTO importBatch (id, organizationId, importId, confirmedById, confirmedByName,
            confirmedAt)
          SELECT ${r.batch}, ${r.org}, ${r.id}, ${r.actor}, ${r.name}, ${r.at} WHERE ${stillOpen(r.org, r.id)}
          RETURNING id`
      })
      const thisConfirm = (org: string, batchId: string) =>
        sql`EXISTS (SELECT 1 FROM importBatch WHERE organizationId = ${org} AND id = ${batchId})`
      const closeDraft = D1.statement({
        Request: CommitScope,
        Result: Ids,
        execute: (r) => sql`UPDATE importDraft SET status = 'imported', importedBy = ${r.name}, importedAt = ${r.at}
          WHERE organizationId = ${r.org} AND id = ${r.id} AND status = 'open' AND ${thisConfirm(r.org, r.batch)}
          RETURNING id`
      })
      // One statement per 500 rows, the rows as one JSON value read with json_each: a handful of bound values a
      // statement however many rows it writes. A stored code is left as it is (ON CONFLICT DO NOTHING).
      const insertItems = D1.statement({
        Request: S.Struct({ ...CommitScope.fields, items: ItemInserts }),
        Result: NoRows,
        execute: (r) => sql`INSERT INTO item (id, organizationId, sku, skuKey, name, description, category, uom,
            unitCost, quantityOnHand, reorderPoint, isActive, lotTracked, tags, firstReceivedOn, discontinuedOn,
            dimensions, vendors, importId, batchId, sourceRow, sourcePart, createdById, createdBy, createdAt)
          SELECT json_extract(value, '$.id'), ${r.org}, json_extract(value, '$.sku'), json_extract(value, '$.skuKey'),
            json_extract(value, '$.name'), json_extract(value, '$.description'), json_extract(value, '$.category'),
            json_extract(value, '$.uom'), json_extract(value, '$.unitCost'), json_extract(value, '$.quantityOnHand'),
            json_extract(value, '$.reorderPoint'), json_extract(value, '$.isActive'),
            json_extract(value, '$.lotTracked'), json_extract(value, '$.tags'),
            json_extract(value, '$.firstReceivedOn'), json_extract(value, '$.discontinuedOn'),
            json_extract(value, '$.dimensions'), json_extract(value, '$.vendors'), ${r.id},
            ${r.batch}, json_extract(value, '$.rowNumber'), json_extract(value, '$.part'), ${r.actor}, ${r.name}, ${r.at}
          FROM json_each(${r.items}) WHERE ${thisConfirm(r.org, r.batch)}
          ON CONFLICT (organizationId, skuKey) DO NOTHING`
      })
      // Before a replace, in the same batch: the stored item as it is, so a take-back of this confirm can put it back.
      // revisionAfter is the revision the replace below gives it; one copy per item, however many rows name it.
      const keepReplaced = D1.statement({
        Request: S.Struct({ ...CommitScope.fields, items: ItemInserts }),
        Result: NoRows,
        execute: (r) => sql`INSERT INTO importReplaced (organizationId, importId, batchId, itemId, sourceRow,
            sourcePart, name, description, category, uom, unitCost, quantityOnHand, reorderPoint, isActive, lotTracked,
            tags, firstReceivedOn, discontinuedOn, dimensions, vendors, revision, updatedById, updatedBy, updatedAt,
            revisionAfter)
          SELECT ${r.org}, ${r.id}, ${r.batch}, i.id, json_extract(j.value, '$.rowNumber'),
            json_extract(j.value, '$.part'), i.name, i.description, i.category, i.uom, i.unitCost, i.quantityOnHand,
            i.reorderPoint, i.isActive, i.lotTracked, i.tags, i.firstReceivedOn, i.discontinuedOn, i.dimensions,
            i.vendors, i.revision, i.updatedById, i.updatedBy, i.updatedAt, i.revision + 1
          FROM json_each(${r.items}) AS j
          JOIN item i ON i.organizationId = ${r.org} AND i.skuKey = json_extract(j.value, '$.skuKey')
          WHERE ${thisConfirm(r.org, r.batch)}
          ON CONFLICT (organizationId, batchId, itemId) DO NOTHING`
      })
      // A stored item the person chose to replace with the file's row: every value but its SKU and its origin is
      // written over, and its revision goes up, so the import that created it can no longer take it back.
      const replaceItems = D1.statement({
        Request: S.Struct({ ...CommitScope.fields, items: ItemInserts }),
        Result: NoRows,
        execute: (r) => sql`UPDATE item SET name = json_extract(j.value, '$.name'),
            description = json_extract(j.value, '$.description'), category = json_extract(j.value, '$.category'),
            uom = json_extract(j.value, '$.uom'), unitCost = json_extract(j.value, '$.unitCost'),
            quantityOnHand = json_extract(j.value, '$.quantityOnHand'),
            reorderPoint = json_extract(j.value, '$.reorderPoint'), isActive = json_extract(j.value, '$.isActive'),
            lotTracked = json_extract(j.value, '$.lotTracked'), tags = json_extract(j.value, '$.tags'),
            firstReceivedOn = json_extract(j.value, '$.firstReceivedOn'),
            discontinuedOn = json_extract(j.value, '$.discontinuedOn'),
            dimensions = json_extract(j.value, '$.dimensions'), vendors = json_extract(j.value, '$.vendors'),
            revision = revision + 1, updatedById = ${r.actor}, updatedBy = ${r.name}, updatedAt = ${r.at}
          FROM json_each(${r.items}) AS j
          WHERE item.organizationId = ${r.org} AND item.skuKey = json_extract(j.value, '$.skuKey')
            AND ${thisConfirm(r.org, r.batch)}`
      })
      // A row counts as created only if its item is really there: a ready row whose code someone else stored in the
      // meantime is reported as already there, never as created. A row an earlier confirm created is created still.
      const landed = (org: string, id: string) => sql`EXISTS (SELECT 1 FROM item r WHERE r.organizationId = ${org}
        AND r.importId = ${id} AND r.sourceRow = json_extract(value, '$.rowNumber')
        AND r.sourcePart = json_extract(value, '$.part'))`
      const insertOutcomes = D1.statement({
        Request: S.Struct({ ...CommitScope.fields, outcomes: OutcomeInserts }),
        Result: NoRows,
        execute: (r) => sql`INSERT INTO importOutcome (importId, organizationId, rowNumber, part, sku, name, outcome,
            reason, decidedBy, decidedByName)
          SELECT ${r.id}, ${r.org}, json_extract(value, '$.rowNumber'), json_extract(value, '$.part'),
            json_extract(value, '$.sku'),
            json_extract(value, '$.name'),
            CASE WHEN json_extract(value, '$.status') = 'update' THEN 'updated'
              WHEN ${landed(r.org, r.id)} THEN 'created'
              WHEN json_extract(value, '$.status') = 'ready' THEN 'already'
              ELSE json_extract(value, '$.status') END,
            CASE WHEN json_extract(value, '$.status') = 'update' OR ${landed(r.org, r.id)} THEN ''
              WHEN json_extract(value, '$.status') = 'ready'
                THEN 'This SKU is already there. It is skipped, not changed.'
              ELSE json_extract(value, '$.reason') END,
            CASE WHEN json_extract(value, '$.status') = 'update' OR ${landed(r.org, r.id)} THEN NULL
              ELSE json_extract(value, '$.decidedBy') END,
            CASE WHEN json_extract(value, '$.status') = 'update' OR ${landed(r.org, r.id)} THEN NULL
              ELSE json_extract(value, '$.decidedByName') END
          FROM json_each(${r.outcomes}) WHERE ${thisConfirm(r.org, r.batch)}
          ON CONFLICT (organizationId, importId, rowNumber, part) DO UPDATE SET sku = excluded.sku, name = excluded.name,
            outcome = excluded.outcome, reason = excluded.reason, decidedBy = excluded.decidedBy,
            decidedByName = excluded.decidedByName`
      })
      // A changed value is recorded only for a row this confirm really created, and only once.
      const insertChanges = D1.statement({
        Request: S.Struct({ ...CommitScope.fields, changes: ChangeInserts }),
        Result: NoRows,
        execute: (r) => sql`INSERT INTO importChange (importId, batchId, organizationId, rowNumber, part, sku, field,
            fromValue, toValue, source, decidedBy, decidedByName, how, basis, confidence, createdAt)
          SELECT ${r.id}, ${r.batch}, ${r.org}, json_extract(value, '$.rowNumber'), json_extract(value, '$.part'),
            json_extract(value, '$.sku'),
            json_extract(value, '$.field'), json_extract(value, '$.from'), json_extract(value, '$.to'),
            json_extract(value, '$.source'), json_extract(value, '$.decidedBy'),
            json_extract(value, '$.decidedByName'), json_extract(value, '$.how'), json_extract(value, '$.basis'),
            json_extract(value, '$.confidence'), ${r.at}
          FROM json_each(${r.changes})
          WHERE ${thisConfirm(r.org, r.batch)} AND (json_extract(value, '$.update') = 1
            OR EXISTS (SELECT 1 FROM item WHERE item.organizationId = ${r.org}
              AND item.batchId = ${r.batch} AND item.sourceRow = json_extract(value, '$.rowNumber')
              AND item.sourcePart = json_extract(value, '$.part')))
          ON CONFLICT (organizationId, batchId, rowNumber, part, field) DO NOTHING`
      })
      // What the confirm did, counted from the rows it stored above, in the same batch.
      const countBatch = D1.statement({
        Request: CommitScope,
        Result: NoRows,
        execute: (r) => sql`UPDATE importBatch SET
            created = (SELECT COUNT(*) FROM item WHERE organizationId = ${r.org} AND batchId = ${r.batch}),
            updated = (SELECT COUNT(*) FROM importOutcome
              WHERE organizationId = ${r.org} AND importId = ${r.id} AND outcome = 'updated'),
            already = (SELECT COUNT(*) FROM importOutcome
              WHERE organizationId = ${r.org} AND importId = ${r.id} AND outcome = 'already'),
            notImported = (SELECT COUNT(*) FROM importOutcome
              WHERE organizationId = ${r.org} AND importId = ${r.id} AND outcome = 'notImported')
          WHERE organizationId = ${r.org} AND id = ${r.batch}`
      })
      const importedLine = D1.statement({
        Request: S.Struct({ ...CommitScope.fields, activity: S.String, fileName: S.String }),
        Result: NoRows,
        execute: (r) => sql`INSERT INTO activity (id, organizationId, actorId, actorName, action, detail, createdAt)
          SELECT ${r.activity}, ${r.org}, ${r.actor}, ${r.name}, 'Imported items',
            'Created ' || (SELECT created FROM importBatch WHERE organizationId = ${r.org} AND id = ${r.batch})
              || ' items'
              || CASE WHEN (SELECT updated FROM importBatch WHERE organizationId = ${r.org} AND id = ${r.batch}) = 0
                THEN '' ELSE ' and replaced '
                  || (SELECT updated FROM importBatch WHERE organizationId = ${r.org} AND id = ${r.batch}) END
              || ' from ' || ${r.fileName}, ${r.at}
          WHERE ${thisConfirm(r.org, r.batch)}`
      })

      const commit = Effect.fn("Imports.commit")(function* (
        actor: Member,
        draft: Draft,
        rows: ReadonlyArray<CommitRow>
      ) {
        const at = yield* now
        const activity = yield* random.uuidV4()
        const batchId = yield* random.uuidV4()
        const scope = { ...acting(actor), id: draft.id, batch: batchId, at }
        const ready = Arr.filter(rows, (row) => row.item !== null && row.status === "ready")
        const replacing = Arr.filter(rows, (row) => row.item !== null && row.status === "update")
        const ids = yield* Effect.forEach(ready, () => random.uuidV4(), { concurrency: 1 })
        const entries = (list: ReadonlyArray<readonly [CommitRow, string]>) =>
          Arr.map(
            bySize(list, ([row]) => textOf(row.item)),
            (chunk) =>
              Arr.flatMap(chunk, ([row, id]) =>
                row.item === null
                  ? []
                  : [{ ...row.item, id, rowNumber: row.rowNumber, part: row.part, skuKey: skuKey(row.item) }]
              )
          )
        const items = entries(Arr.zip(ready, ids))
        const replacements = entries(Arr.map(replacing, (row) => [row, ""] as const))
        const outcomes = Arr.map(
          bySize(rows, (row) => row.sku.length + row.name.length + row.reason.length),
          (chunk) =>
            Arr.map(chunk, (row) => ({
              rowNumber: row.rowNumber,
              part: row.part,
              sku: row.sku,
              name: row.name,
              status: row.status,
              reason: row.reason,
              decidedBy: row.decidedBy,
              decidedByName: row.decidedByName
            }))
        )
        const changes = bySize(
          Arr.flatMap(rows, (row) =>
            Arr.map(row.changes, (change) => ({
              ...change,
              rowNumber: row.rowNumber,
              part: row.part,
              sku: row.sku,
              update: row.status === "update"
            }))
          ),
          (change) => change.from.length + change.to.length + (change.basis ?? "").length + change.sku.length
        )
        const [confirmed] = yield* batch([
          insertBatch(scope),
          closeDraft(scope),
          ...Arr.map(items, (chunk) => insertItems({ ...scope, items: chunk })),
          ...Arr.map(replacements, (chunk) => keepReplaced({ ...scope, items: chunk })),
          ...Arr.map(replacements, (chunk) => replaceItems({ ...scope, items: chunk })),
          ...Arr.map(outcomes, (chunk) => insertOutcomes({ ...scope, outcomes: chunk })),
          ...Arr.map(changes, (chunk) => insertChanges({ ...scope, changes: chunk })),
          countBatch(scope),
          importedLine({ ...scope, activity, fileName: draft.fileName })
        ])
        // The first statement returns the confirm's id only when this batch was the one that confirmed the import.
        return confirmed.length > 0
      }, Effect.orDie)

      // -- Taking a confirm back -----------------------------------------------------------------------------

      const TakeBackScope = S.Struct({
        ...Acting,
        id: S.String,
        takeBack: S.String,
        confirms: IdList,
        at: S.String
      })
      const ofTakeBack = (org: string, takeBack: string) =>
        sql`(SELECT id FROM importBatch WHERE organizationId = ${org} AND takeBackId = ${takeBack})`
      // First: mark the confirms in force that were asked for. Every later statement acts only on the confirms this
      // take-back marked, so a second press, which marks none, writes nothing.
      const markConfirms = D1.statement({
        Request: TakeBackScope,
        Result: Ids,
        execute: (r) => sql`UPDATE importBatch SET takeBackId = ${r.takeBack}, takenBackById = ${r.actor},
            takenBackByName = ${r.name}, takenBackAt = ${r.at}
          WHERE organizationId = ${r.org} AND importId = ${r.id} AND takeBackId IS NULL
            AND id IN (SELECT value FROM json_each(${r.confirms}))
          RETURNING id`
      })
      // Then the stored items those confirms replaced go back to their copies, each only while it is still at the
      // revision the replace gave it: one someone edited, or a later import replaced again, is kept as it is. A pass
      // marks the copies it will use, then writes them; a second pass reaches an item two confirms of this take-back
      // replaced in turn, now back at the revision the earlier replace gave it.
      const flagRestorable = D1.statement({
        Request: TakeBackScope,
        Result: NoRows,
        execute: (r) => sql`UPDATE importReplaced SET restored = 1
          WHERE organizationId = ${r.org} AND restored = 0 AND batchId IN ${ofTakeBack(r.org, r.takeBack)}
            AND EXISTS (SELECT 1 FROM item WHERE item.organizationId = ${r.org} AND item.id = importReplaced.itemId
              AND item.revision = importReplaced.revisionAfter)`
      })
      const restoreItems = D1.statement({
        Request: TakeBackScope,
        Result: NoRows,
        execute: (r) => sql`UPDATE item SET name = p.name, description = p.description, category = p.category,
            uom = p.uom, unitCost = p.unitCost, quantityOnHand = p.quantityOnHand, reorderPoint = p.reorderPoint,
            isActive = p.isActive, lotTracked = p.lotTracked, tags = p.tags, firstReceivedOn = p.firstReceivedOn,
            discontinuedOn = p.discontinuedOn, dimensions = p.dimensions, vendors = p.vendors, revision = p.revision,
            updatedById = p.updatedById, updatedBy = p.updatedBy, updatedAt = p.updatedAt
          FROM importReplaced AS p
          WHERE item.organizationId = ${r.org} AND p.organizationId = ${r.org} AND p.itemId = item.id
            AND p.restored = 1 AND item.revision = p.revisionAfter
            AND p.batchId IN ${ofTakeBack(r.org, r.takeBack)}`
      })
      // Counted once the items are put back and before any is removed: what this take-back removes (items still at
      // revision 1), restores (copies it used) and keeps (items it created, or replaced, that someone changed since).
      const countTakeBack = D1.statement({
        Request: TakeBackScope,
        Result: NoRows,
        execute: (r) => sql`UPDATE importBatch SET
            removed = (SELECT COUNT(*) FROM item
              WHERE organizationId = ${r.org} AND batchId = importBatch.id AND revision = 1),
            restored = (SELECT COUNT(*) FROM importReplaced
              WHERE organizationId = ${r.org} AND batchId = importBatch.id AND restored = 1),
            kept = (SELECT COUNT(*) FROM item
              WHERE organizationId = ${r.org} AND batchId = importBatch.id AND revision > 1)
              + (SELECT COUNT(*) FROM importReplaced
                WHERE organizationId = ${r.org} AND batchId = importBatch.id AND restored = 0)
          WHERE organizationId = ${r.org} AND takeBackId = ${r.takeBack}`
      })
      const takenBackLine = D1.statement({
        Request: S.Struct({ ...TakeBackScope.fields, activity: S.String, fileName: S.String }),
        Result: NoRows,
        execute: (r) => {
          const removed = sql`(SELECT COALESCE(SUM(removed), 0) FROM importBatch
            WHERE organizationId = ${r.org} AND takeBackId = ${r.takeBack})`
          const kept = sql`(SELECT COALESCE(SUM(kept), 0) FROM importBatch
            WHERE organizationId = ${r.org} AND takeBackId = ${r.takeBack})`
          const restored = sql`(SELECT COALESCE(SUM(restored), 0) FROM importBatch
            WHERE organizationId = ${r.org} AND takeBackId = ${r.takeBack})`
          return sql`INSERT INTO activity (id, organizationId, actorId, actorName, action, detail, createdAt)
            SELECT ${r.activity}, ${r.org}, ${r.actor}, ${r.name}, 'Took back an import',
              ${r.fileName} || ': removed ' || ${removed} || CASE WHEN ${removed} = 1 THEN ' item' ELSE ' items' END
                || CASE WHEN ${restored} = 0 THEN ''
                  WHEN ${restored} = 1 THEN ', restored 1 item it had replaced'
                  ELSE ', restored ' || ${restored} || ' items it had replaced' END
                || CASE WHEN ${kept} = 0 THEN ''
                  WHEN ${kept} = 1 THEN ', kept 1 that had changed since'
                  ELSE ', kept ' || ${kept} || ' that had changed since' END,
              ${r.at}
            WHERE EXISTS ${ofTakeBack(r.org, r.takeBack)}`
        }
      })
      // The rows whose items go, while the items are still there to say which rows they are.
      const markOutcomes = D1.statement({
        Request: TakeBackScope,
        Result: NoRows,
        execute: (r) => sql`UPDATE importOutcome SET outcome = 'takenBack', reason = '', decidedBy = NULL,
            decidedByName = NULL
          WHERE organizationId = ${r.org} AND importId = ${r.id} AND outcome = 'created'
            AND EXISTS (SELECT 1 FROM item WHERE item.organizationId = ${r.org} AND item.importId = ${r.id}
              AND item.sourceRow = importOutcome.rowNumber AND item.sourcePart = importOutcome.part
              AND item.revision = 1 AND item.batchId IN ${ofTakeBack(r.org, r.takeBack)})`
      })
      // The rows whose replace was undone, from the copies this take-back used.
      const markReplacedOutcomes = D1.statement({
        Request: TakeBackScope,
        Result: NoRows,
        execute: (r) => sql`UPDATE importOutcome SET outcome = 'takenBack', reason = '', decidedBy = NULL,
            decidedByName = NULL
          WHERE organizationId = ${r.org} AND importId = ${r.id} AND outcome = 'updated'
            AND EXISTS (SELECT 1 FROM importReplaced p WHERE p.organizationId = ${r.org} AND p.importId = ${r.id}
              AND p.sourceRow = importOutcome.rowNumber AND p.sourcePart = importOutcome.part AND p.restored = 1
              AND p.batchId IN ${ofTakeBack(r.org, r.takeBack)})`
      })
      const removeItems = D1.statement({
        Request: TakeBackScope,
        Result: NoRows,
        execute: (r) => sql`DELETE FROM item WHERE organizationId = ${r.org} AND revision = 1
          AND batchId IN ${ofTakeBack(r.org, r.takeBack)}`
      })
      // Taken back once nothing of it is in force; a confirm made in between (another tab) keeps it imported.
      const settleDraft = D1.statement({
        Request: TakeBackScope,
        Result: NoRows,
        execute: (r) => sql`UPDATE importDraft SET revision = revision + 1,
            status = CASE WHEN status = 'imported' AND NOT EXISTS (SELECT 1 FROM importBatch
              WHERE organizationId = ${r.org} AND importId = ${r.id} AND takeBackId IS NULL) THEN 'takenBack'
              ELSE status END
          WHERE organizationId = ${r.org} AND id = ${r.id} AND EXISTS ${ofTakeBack(r.org, r.takeBack)}`
      })

      const takeBack = Effect.fn("Imports.takeBack")(function* (
        actor: Member,
        draft: Draft,
        confirms: ReadonlyArray<string>
      ) {
        const at = yield* now
        const activity = yield* random.uuidV4()
        const takeBackId = yield* random.uuidV4()
        const scope = { ...acting(actor), id: draft.id, takeBack: takeBackId, confirms, at }
        // One restore pass per confirm asked for (at most 10): enough for an item each of them replaced in turn.
        const passes = Arr.flatMap(Arr.range(1, Math.min(Math.max(confirms.length, 1), 10)), () => [
          flagRestorable(scope),
          restoreItems(scope)
        ])
        const [marked] = yield* batch([
          markConfirms(scope),
          ...passes,
          countTakeBack(scope),
          takenBackLine({ ...scope, activity, fileName: draft.fileName }),
          markOutcomes(scope),
          markReplacedOutcomes(scope),
          removeItems(scope),
          settleDraft(scope)
        ])
        return marked.length > 0
      }, Effect.orDie)

      const history = Effect.fn("Imports.history")(function* (organizationId: OrganizationId, importId: string) {
        const confirms = yield* findBatches({ org: organizationId, id: importId })
        // One take-back can reverse several confirms of the import. It is one event, and its numbers are the sums
        // over every confirm it reversed, so "removed" is every item that take-back removed, not the last confirm's.
        const sameTakeBack = (row: (typeof confirms)[number]) =>
          Arr.filter(confirms, (other) => other.takeBackId !== null && other.takeBackId === row.takeBackId)
        const firstOf = (row: (typeof confirms)[number]): boolean => sameTakeBack(row)[0]?.id === row.id
        const events = Arr.flatMap(confirms, (row): ReadonlyArray<ImportEvent> => [
          ImportEvent.cases.Confirmed.make({
            batchId: row.id,
            by: row.confirmedByName,
            at: row.confirmedAt,
            created: row.created,
            updated: row.updated,
            already: row.already,
            notImported: row.notImported
          }),
          // A take-back stamps who and when in one statement: an event is said only when both are stored.
          ...(Option.isNone(row.takenBackAt) || Option.isNone(row.takenBackByName) || !firstOf(row)
            ? []
            : [
                ImportEvent.cases.TakenBack.make({
                  batchId: row.id,
                  by: row.takenBackByName.value,
                  at: row.takenBackAt.value,
                  removed: Arr.reduce(sameTakeBack(row), 0, (total, other) => total + other.removed),
                  restored: Arr.reduce(sameTakeBack(row), 0, (total, other) => total + other.restored),
                  kept: Arr.reduce(sameTakeBack(row), 0, (total, other) => total + other.kept)
                })
              ])
        ])
        return Arr.sort(
          events,
          Order.mapInput(DateTime.Order, (event: ImportEvent) => event.at)
        )
      }, Effect.orDie)

      // What a take-back would do now: four reads in one batch, so they describe the same moment.
      const inForce = (org: string, id: string) => sql`(SELECT id FROM importBatch
        WHERE organizationId = ${org} AND importId = ${id} AND takeBackId IS NULL)`
      const confirmsInForce = D1.statement({
        Request: Scope,
        Result: Ids,
        execute: (r) => sql`SELECT id FROM importBatch WHERE organizationId = ${r.org} AND importId = ${r.id}
          AND takeBackId IS NULL ORDER BY confirmedAt, rowid`
      })
      const removableCount = D1.statement({
        Request: Scope,
        Result: Count,
        execute: (r) => sql`SELECT COUNT(*) AS n FROM item WHERE organizationId = ${r.org} AND importId = ${r.id}
          AND revision = 1 AND batchId IN ${inForce(r.org, r.id)}`
      })
      // A stored item a confirm in force replaced, still as the replace left it: a take-back puts it back.
      const restorableCount = D1.statement({
        Request: Scope,
        Result: Count,
        execute: (r) => sql`SELECT COUNT(*) AS n FROM importReplaced p
          JOIN item i ON i.organizationId = p.organizationId AND i.id = p.itemId
          WHERE p.organizationId = ${r.org} AND p.importId = ${r.id} AND p.batchId IN ${inForce(r.org, r.id)}
            AND i.revision = p.revisionAfter`
      })
      // Items the import created that changed since, and stored items it replaced that changed since the replace.
      // `kept`: those an earlier take-back kept; otherwise those a take-back now would keep.
      const changedItems = (kept: boolean) =>
        D1.statement({
          Request: Scope,
          Result: S.Array(ChangedItemRow),
          execute: (r) => sql`SELECT sku, name, updatedBy AS changedBy, updatedAt AS changedAt FROM item
            WHERE organizationId = ${r.org} AND importId = ${r.id} AND revision > 1
              AND ${kept ? sql`batchId NOT IN ${inForce(r.org, r.id)}` : sql`batchId IN ${inForce(r.org, r.id)}`}
            UNION
            SELECT i.sku, i.name, i.updatedBy AS changedBy, i.updatedAt AS changedAt FROM importReplaced p
              JOIN item i ON i.organizationId = p.organizationId AND i.id = p.itemId
            WHERE p.organizationId = ${r.org} AND p.importId = ${r.id}
              AND ${
                kept
                  ? sql`p.restored = 0 AND p.batchId NOT IN ${inForce(r.org, r.id)}`
                  : sql`i.revision <> p.revisionAfter AND p.batchId IN ${inForce(r.org, r.id)}`
              }
            ORDER BY changedAt DESC, sku`
        })

      const takeBackState = Effect.fn("Imports.takeBackState")(function* (
        organizationId: OrganizationId,
        importId: string
      ) {
        const scope = { org: organizationId, id: importId }
        const [confirms, removable, restorable, changed, kept] = yield* batch([
          confirmsInForce(scope),
          removableCount(scope),
          restorableCount(scope),
          changedItems(false)(scope),
          changedItems(true)(scope)
        ])
        const named = (rows: typeof changed) =>
          Arr.map(Arr.take(rows, changedItemsShown), (row) =>
            ChangedItem.make({
              sku: row.sku,
              name: row.name,
              changedBy: row.changedBy,
              changedAt: row.changedAt
            })
          )
        return {
          confirms: Arr.map(confirms, (row) => row.id),
          removable: Option.match(Arr.head(removable), { onNone: () => 0, onSome: (row) => row.n }),
          restorable: Option.match(Arr.head(restorable), { onNone: () => 0, onSome: (row) => row.n }),
          changed: named(changed),
          changedCount: changed.length,
          kept: named(kept),
          keptCount: kept.length
        }
      }, Effect.orDie)

      return Imports.of({
        beginUpload,
        findUpload: Effect.fn("Imports.findUpload")(function* (actor: Member, id: string) {
          return yield* findUploadRow({ org: actor.organizationId, actor: actor.id, id }).pipe(Effect.orDie)
        }),
        putChunk,
        uploadChunks,
        finishUpload,
        discardUpload,
        table,
        storedAmong,
        fixed: Effect.fn("Imports.fixed")(function* (organizationId: OrganizationId, importId: string) {
          return yield* findFixed({ org: organizationId, id: importId }).pipe(Effect.orDie)
        }),
        commit,
        takeBack,
        history,
        takeBackState,
        decisions,
        decide,
        reopen,
        listOpen,
        listPast,
        remove,
        choices,
        setChoices,
        createdRows,
        rewriteDecisions,
        changes: Effect.fn("Imports.changes")(function* (organizationId: OrganizationId) {
          const rows = yield* findChanges(organizationId).pipe(Effect.orDie)
          return Arr.map(rows, ({ part, ...row }) => ({ ...row, ...partOf(part) }))
        }),
        find: Effect.fn("Imports.find")(function* (organizationId: OrganizationId, id: string) {
          return yield* findDraft({ org: organizationId, id }).pipe(Effect.orDie)
        }),
        outcomes: Effect.fn("Imports.outcomes")(function* (organizationId: OrganizationId, importId: string) {
          const rows = yield* findOutcomes({ org: organizationId, id: importId }).pipe(Effect.orDie)
          return Arr.map(rows, ({ part, ...row }) => ({ ...row, ...partOf(part) }))
        }),
        items: Effect.fn("Imports.items")(function* (organizationId: OrganizationId) {
          return yield* findItems(organizationId).pipe(Effect.orDie)
        })
      })
    })
  ).pipe(Layer.provide(SecureRandom.layerWebCrypto))
}
