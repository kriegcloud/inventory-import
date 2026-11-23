// Storage for imports: the staged file, what each confirm did with each row, the items it created, and taking a
// confirm back. SQL lives here only; every statement filters on the organization, and goes through a Schema both ways
// (`SqlSchema` for a read, `D1.statement` from @beep/d1 for a write). The rules not to break: a confirm is the only
// statement that adds to `item` (and keeps a copy of each item it replaces, in `importReplaced`), and a take-back the
// only one that deletes from it or puts a replaced item back; each is one atomic batch whose
// every statement checks the same condition (the import is still open; the confirm is still in force), so a second
// press, a retry or another tab writes nothing.
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as Result from "effect/Result"
import { chunkRows } from "@inventory/catalog-contract/Upload"
import * as S from "effect/Schema"
import { StagedHead, StagedRow, Field } from "@inventory/catalog-contract/Staged"
import { RowDecision, DecisionDelta } from "@inventory/catalog-contract/Decision"
import { ColumnMove, MappingChoice } from "@inventory/catalog-contract/Mapping"
import { OrganizationId, MemberId } from "@inventory/kernel/Ids"
import { ChangeSource, Confidence, changeToStored, changeFromStored } from "@inventory/catalog-contract/Change"
import { ImportId, ConfirmId, ItemId, UploadKey } from "@inventory/catalog-contract/Ids"
import { Instant, DisplayName } from "@inventory/kernel/Text"
import {
  OutcomeKind,
  DecidedByKind,
  DecidedBy,
  decidedByPerson,
  decidedByNobody,
  PastImport,
  ImportEvent,
  changedItemsShown,
  ChangedItem,
  ChangeRecord,
  MatchTakeBack,
  outcomeOf
} from "@inventory/catalog-contract/Import"
import {
  ImportStore,
  type ChoicesSaved,
  Draft,
  draftTries,
  Upload,
  ConfirmWrite,
  type ComparedAt,
  confirmWritten,
  confirmClosed,
  confirmMoved,
  confirmItemsChanged,
  TakeBackWrite,
  tookBack,
  nothingInForce,
  decisionsSaved,
  decisionsClosed,
  decisionsRematched,
  decisionsMoved,
  decisionsItemsChanged
} from "@inventory/catalog-model/ImportStore"
import * as SqlClient from "effect/sql/SqlClient"
import * as SqlSchema from "effect/sql/SqlSchema"
import type * as Statement from "effect/sql/Statement"
import { D1, NoRows } from "@beep/d1/D1"
import * as SecureRandom from "effect/crypto/SecureRandom"
import { Member } from "@inventory/kernel/Member"
import { ItemRow, itemColumns, storedItem } from "./internal/itemRow.ts"
import { abandonedAfterMinutes, maxChunkChars } from "@inventory/catalog-model/Upload"
import { fileProblem } from "@inventory/catalog-contract/FileProblem"
import { lineOf } from "./internal/auditLine.ts"
import { jsonPieces, piece } from "./internal/pieces.ts"
import { AbandonedBefore, Acting, HeadJson, ItemInsert, ItemsPiece, UploadInsert } from "./internal/importRows.ts"
import { D1Instant } from "@beep/d1/D1Instant"
import { plannedItems, PlannedRow } from "@inventory/catalog-model/Confirm"
import {
  type CompareAtMatch,
  type ItemsAsRead,
  noItemsRead,
  noComparison,
  planMatch,
  takenBackOfMatch,
  takenBackWords,
  withTakeBacks
} from "@inventory/catalog-model/Rematch"

const RowsJson = StagedRow.pipe(S.Array, S.fromJsonString)
const DecisionJson = S.fromJsonString(RowDecision)
const ChoicesJson = MappingChoice.pipe(S.Array, S.fromJsonString)
const MovesJson = ColumnMove.pipe(S.Array, S.fromJsonString)
const TakenBackJson = MatchTakeBack.pipe(S.Array, S.fromJsonString)
// One stored item a question to the review read, at its revision.
const ItemRead = S.Struct({ id: ItemId, revision: S.Int })
// One of the import's created rows a question to the review read, by row and part.
const CreatedRead = S.Struct({ rowNumber: S.Int, part: S.Int })
const IdList = S.String.pipe(S.Array, S.fromJsonString).annotate({
  description: "Ids or keys bound as one JSON parameter and read with json_each"
})

const Scope = S.Struct({ org: OrganizationId, id: S.String }).annotate({
  description: "One row of one organization, by id"
})
const Ids = S.Array(S.Struct({ id: S.String })).annotate({ description: "The ids a write returned" })
const Count = S.Array(S.Struct({ n: S.Int })).annotate({ description: "One COUNT(*)" })

// One decision as it travels to SQL: the row it is for, and the decision as the JSON `importDecision` stores.
const DecisionEntry = S.Struct({ rowId: S.String, json: DecisionJson })

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

// One changed value a confirm items.
// A change as `importChange`'s columns hold it: the words of `how` are the ones the table has always stored.
const storedChange = {
  field: Field,
  from: S.String,
  to: S.String,
  source: ChangeSource,
  decidedBy: S.Literals(["person", "rule"]),
  how: S.Literals(["accepted a proposal", "typed or chose a value", "applied by a rule"]),
  basis: S.NullOr(S.String),
  confidence: S.NullOr(Confidence)
}

const ChangeInsert = S.Struct({
  ...storedChange,
  rowNumber: S.Int,
  part: S.Int,
  sku: S.String,
  update: S.Boolean,
  decidedByName: S.NullOr(S.String)
}).annotate({ description: "One value a confirm writes that differs from the file" })

// The pieces the long lists travel in (`internal/pieces.ts`): as many values as a statement reads well, and never more
// bytes than a bound value may have.
const textPieces = jsonPieces({ of: S.String, most: 5000 })
const itemReadPieces = jsonPieces({ of: ItemRead, most: 5000 })
const createdReadPieces = jsonPieces({ of: CreatedRead, most: 5000 })
const decisionEntryPieces = jsonPieces({ of: DecisionEntry, most: 2000 })
const itemPieces = jsonPieces({ of: ItemInsert, most: chunkRows })
const outcomePieces = jsonPieces({ of: OutcomeInsert, most: chunkRows })
const changePieces = jsonPieces({ of: ChangeInsert, most: chunkRows })
/** Decisions as they travel to SQL, in pieces. */
const decisionPieces = (set: Readonly<Record<string, RowDecision>>) =>
  decisionEntryPieces(A.map(R.toEntries(set), ([rowId, json]) => ({ rowId, json })))

const ChangeRow = S.Struct({
  importId: ImportId,
  fileName: S.String,
  rowNumber: S.Int,
  part: S.Int,
  sku: S.String,
  ...storedChange,
  decidedByName: S.NullOr(S.String),
  createdAt: Instant,
  takenBack: S.BooleanFromBit
}).annotate({
  description:
    "A changed value as stored, with its part (0 for a row that is one item) and whether its item was taken back as 0 or 1"
})

// What a confirm stored for one item of the file, its part as stored: 0 for a row that is one item.
const OutcomeRow = S.Struct({
  rowNumber: S.Int,
  part: S.Int,
  sku: S.String,
  name: S.String,
  outcome: OutcomeKind,
  reason: S.String,
  decidedBy: S.NullOr(DecidedByKind),
  decidedByName: S.NullOr(S.String)
}).annotate({ description: "What the confirms did with one item of the file, as stored" })

/** Who the stored columns say left a row out: the person, when their name was kept with it; otherwise nobody. */
const whoDecided = (row: typeof OutcomeRow.Type): DecidedBy =>
  row.decidedBy === "person" && row.decidedByName !== null && S.is(DisplayName)(row.decidedByName)
    ? decidedByPerson(row.decidedByName)
    : decidedByNobody

// A confirm as `importBatch` stores it: what it did, and the take-back that reversed it, if one did.
const BatchRow = S.Struct({
  id: ConfirmId,
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

/** `ImportStore` on D1: every statement as it was, each write one atomic batch. */
export const ImportStoreD1 = Layer.effect(
  ImportStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const d1 = yield* D1
    const { batch, run } = d1
    const random = yield* SecureRandom.SecureRandom
    const now = DateTime.now
    const acting = (actor: Member) => ({ org: actor.organizationId, actor: actor.id, name: actor.name })

    // -- Reads ---------------------------------------------------------------------------------------------------

    const draftColumns = sql`id, fileName, headJson, rowCount, status, actorName, createdAt, importedBy, importedAt,
      revision, needsAtStart, choicesJson, movesJson, takenBackJson, takenBackFrom`
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
      Result: S.Struct({
        rowId: S.String,
        decisionJson: S.String,
        decidedById: S.String,
        decidedByName: S.String,
        savedRevision: S.Int,
        lastSavedById: S.NullOr(S.String),
        lastSavedRevision: S.Int
      }),
      execute: ({ org, id }) =>
        sql`SELECT rowId, decisionJson, decidedById, decidedByName, savedRevision, lastSavedById, lastSavedRevision
          FROM importDecision WHERE organizationId = ${org} AND importId = ${id}`
    })
    // How many saves have named a row of the draft: read before its rows, so a save that lands in between is seen.
    const findSaves = SqlSchema.findAll({
      Request: Scope,
      Result: S.Struct({ saves: S.Int }),
      execute: ({ org, id }) => sql`SELECT saves FROM importDraft WHERE organizationId = ${org} AND id = ${id}`
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
      Request: S.Struct({ org: OrganizationId, keys: piece(S.String) }),
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
      Request: S.Struct({ org: OrganizationId, actor: MemberId, key: UploadKey }),
      Result: S.Struct({ id: ImportId }),
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
      Request: AbandonedBefore,
      Result: NoRows,
      execute: (r) => sql`DELETE FROM importUploadChunk WHERE organizationId = ${r.org}
        AND uploadId IN (SELECT id FROM importUpload WHERE organizationId = ${r.org} AND createdAt < ${r.before})`
    })
    const dropAbandonedUploads = D1.statement({
      Request: AbandonedBefore,
      Result: NoRows,
      execute: (r) => sql`DELETE FROM importUpload WHERE organizationId = ${r.org} AND createdAt < ${r.before}`
    })
    const insertUpload = D1.statement({
      Request: UploadInsert,
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
      const made = yield* random.uuidV4()
      const id = ImportId.make(made)
      const uploadKey = yield* S.decodeEffect(UploadKey)(key).pipe(Effect.orDie)
      const at = yield* now
      const before = DateTime.subtract(at, { minutes: abandonedAfterMinutes })
      const headJson = yield* S.encodeEffect(HeadJson)(head).pipe(Effect.orDie)
      // D1 refuses a value over 2 MB. Say so in words before it does.
      if (headJson.length > maxChunkChars) {
        return Result.fail(fileProblem.tooLong({ fileName: head.fileName, part: "headings" }))
      }
      const org = actor.organizationId
      yield* batch([
        dropAbandonedChunks({ org, before }),
        dropAbandonedUploads({ org, before }),
        insertUpload({ ...acting(actor), id, key: uploadKey, fileName: head.fileName, headJson: head, ...counts, at })
      ]).pipe(Effect.orDie)
      // The upload this key started: the one just written, or the one an earlier begin with the same key wrote.
      const started = yield* findUploadByKey({ org, actor: actor.id, key: uploadKey }).pipe(Effect.orDie)
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
      Request: S.Struct({ ...UploadScope.fields, at: D1Instant, needsAtStart: S.Int }),
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
        at: D1Instant
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
      return { ...head, rows: A.flatten(rows) }
    }, Effect.orDie)

    const decisions = Effect.fn("Imports.decisions")(function* (organizationId: OrganizationId, importId: string) {
      const saves = yield* findSaves({ org: organizationId, id: importId })
      const rows = yield* findDecisions({ org: organizationId, id: importId })
      const decoded = yield* Effect.forEach(
        rows,
        (row) =>
          Effect.map(S.decodeEffect(DecisionJson)(row.decisionJson), (decision) => [row.rowId, decision] as const),
        { concurrency: 1 }
      )
      return {
        decisions: R.fromEntries(decoded),
        authors: R.fromEntries(A.map(rows, (row) => [row.rowId, row.decidedByName] as const)),
        deciders: R.fromEntries(A.map(rows, (row) => [row.rowId, row.decidedById] as const)),
        savedAt: R.fromEntries(A.map(rows, (row) => [row.rowId, row.savedRevision] as const)),
        // A row stored before who last saved it was kept has no name: it cannot say, and is never the sender's.
        lastSavedBy: R.fromEntries(
          A.flatMap(rows, (row) => (row.lastSavedById === null ? [] : [[row.rowId, row.lastSavedById] as const]))
        ),
        lastSavedOn: R.fromEntries(A.map(rows, (row) => [row.rowId, row.lastSavedRevision] as const)),
        saves: O.match(A.head(saves), { onNone: () => 0, onSome: (row) => row.saves })
      }
    }, Effect.orDie)

    // -- The lists a write carries --------------------------------------------------------------------------------
    //
    // D1 binds at most 100 values to a statement and holds at most 2 MB in one, and a file may have 50,000 rows
    // (`maxStagedRows`), so no statement binds a value per piece of a list. The lists a save, a match and a confirm
    // carry are put into `importWriteList` first, a piece to a statement; the statements that need a whole list read
    // it back (3 values bound, however long it is); the last statement deletes them. It is one batch, so nobody sees
    // them and a batch that fails leaves none.
    //
    // What each statement of those three batches binds, for a file of any length:
    //
    //   a piece put (putPiece)        6 = write, list, seq, piece, org, import; 7 with the revision it is put at
    //   the guard (itemsAsRead)      20 = items under the keys 5 (org, keys 3, found), each item read 3, created rows
    //                                     counted 3 and each 3, suggestions counted 3 and each 3
    //   openChoices                  22 = the guard 20, org, import
    //   bumpRevision                 31 = org, import, choices, the guard 20, sets 3, clears 5 (org, import, 3)
    //   upsertDecisions              31 = import, org, actor, name, at, sets 3, sameChoices 23 (3 and the guard)
    //   clearDecisions               28 = org, import, clears 3, sameChoices 23
    //   matchedLine                  30 = 6 of the line, org, import, revision, choices, the guard 20
    //   insertBatch                  29 = 6 of the confirm's row, org, import, revision, the guard 20
    //   saveChoice 9, closeDraft 6, countBatch 10, importedLine 14, openRevision 2, dropLists 2
    //   one per piece: rewriteDecisions 6, saveAtConfirm 10, clearAtConfirm 5, insertItems 9, keepReplaced 7,
    //     replaceItems 8, insertOutcomes 13, insertChanges 9; a read of stored items by key (findStored) 2
    //
    // What grows with the file is how many statements a batch has, never what one binds: 31 at most, at 50,000 rows as
    // at one. At 50,000 rows a list is put in 25 statements (decisions set) or 10 (cleared, keys, items found, each
    // 50,000 created rows); texts long enough to pass `pieceBytes` a piece make more of them. Every other
    // statement here binds a fixed handful, its rows (if any) as one JSON value (a take-back's confirms, at most 10).
    type ListName = "sets" | "clears" | "keys" | "items" | "created" | "suggestions"
    //
    // A list given a revision is put only while the draft is at it, before anything in the batch moves it: at another
    // one there is nothing to write from, so nothing of the save is written.
    const putList = <Value, Wire>(list: ListName, of: S.Codec<Value, Wire>) =>
      D1.statement({
        Request: S.Struct({
          org: OrganizationId,
          id: S.String,
          write: S.String,
          seq: S.Int,
          piece: piece(of),
          expected: S.NullOr(S.Int),
          expectedSaves: S.NullOr(S.Int)
        }),
        Result: NoRows,
        execute: (r) => sql`INSERT INTO importWriteList (organizationId, importId, writeId, list, seq, piece)
          SELECT organizationId, id, ${r.write}, ${list}, ${r.seq}, ${r.piece} FROM importDraft
          WHERE organizationId = ${r.org} AND id = ${r.id}${r.expected === null ? sql`` : sql` AND revision = ${r.expected}`}${r.expectedSaves === null ? sql`` : sql` AND saves = ${r.expectedSaves}`}`
      })
    const putSets = putList("sets", DecisionEntry)
    const putClears = putList("clears", S.String)
    const putKeys = putList("keys", S.String)
    const putItems = putList("items", ItemRead)
    const putCreated = putList("created", CreatedRead)
    const putSuggestions = putList("suggestions", S.String)
    const dropLists = D1.statement({
      Request: S.Struct({ org: OrganizationId, write: S.String }),
      Result: NoRows,
      execute: (r) => sql`DELETE FROM importWriteList WHERE organizationId = ${r.org} AND writeId = ${r.write}`
    })
    // One of a write's lists, as a FROM clause and its condition: `j.value` is one value of it, `w` the piece it is in.
    const inList = (org: string, write: string, list: ListName) => sql`importWriteList AS w, json_each(w.piece) AS j
      WHERE w.organizationId = ${org} AND w.writeId = ${write} AND w.list = ${list}`

    // A decision differs from what is stored when the row has none yet, or a different one.
    const differs = (org: string, write: string) => sql`EXISTS (SELECT 1 FROM ${inList(org, write, "sets")}
      AND NOT EXISTS (SELECT 1 FROM importDecision d WHERE d.organizationId = w.organizationId
        AND d.importId = w.importId AND d.rowId = json_extract(j.value, '$.rowId')
        AND d.decisionJson = json_extract(j.value, '$.json')))`
    const clears = (org: string, id: string, write: string) => sql`EXISTS (SELECT 1 FROM importDecision
      WHERE organizationId = ${org} AND importId = ${id} AND rowId IN (SELECT j.value FROM ${inList(org, write, "clears")}))`
    // What a judgement of the decisions read (a match's, a save's, a confirm's), counted; the keys it looked up, the
    // items it found (each with its revision), the import's created rows and its suggestions are the write's lists.
    // `asked` 0 when the file's review was not asked: nothing was read, nothing is checked, no list is put.
    const ItemsGuard = S.Struct({
      write: S.String,
      asked: S.Int,
      found: S.Int,
      createdCount: S.Int,
      suggestionCount: S.Int
    })
    const guardOf = (write: string, read: ItemsAsRead): typeof ItemsGuard.Type => ({
      write,
      asked: read.asked ? 1 : 0,
      found: read.items.length,
      createdCount: read.created.length,
      suggestionCount: read.suggestions.length
    })
    // The statements that put what a judgement read where the guard below reads it, at whatever revision the draft is.
    const putRead = Effect.fnUntraced(function* (
      scope: { readonly org: OrganizationId; readonly id: string; readonly write: string },
      read: ItemsAsRead
    ) {
      if (!read.asked) return []
      const keys = yield* textPieces(read.keys)
      const items = yield* itemReadPieces(read.items)
      const created = yield* createdReadPieces(read.created)
      const suggestions = yield* textPieces(read.suggestions)
      return [
        ...A.map(keys, (piece, seq) => putKeys({ ...scope, seq, piece, expected: null, expectedSaves: null })),
        ...A.map(items, (piece, seq) => putItems({ ...scope, seq, piece, expected: null, expectedSaves: null })),
        ...A.map(created, (piece, seq) => putCreated({ ...scope, seq, piece, expected: null, expectedSaves: null })),
        ...A.map(suggestions, (piece, seq) =>
          putSuggestions({ ...scope, seq, piece, expected: null, expectedSaves: null })
        )
      ]
    })
    // What the judgement read of import `id` is still so: the organization's items under those keys exactly the ones
    // read, each still at the revision read (one edited, replaced, created or taken back since makes this false); the
    // import's created rows exactly those read (a take-back marks them); its suggestions exactly those read (a request
    // for suggestions stores more, and storing one moves no revision). A count and a check of each, so nothing is
    // missed.
    const itemsAsRead = (org: string, id: string, guard: typeof ItemsGuard.Encoded) => {
      if (guard.asked === 0) return sql`1=1`
      const eachThere = (list: ListName, there: Statement.Fragment) =>
        sql`NOT EXISTS (SELECT 1 FROM ${inList(org, guard.write, list)} AND NOT ${there})`
      const created = sql`(SELECT COUNT(*) FROM importOutcome WHERE organizationId = ${org} AND importId = ${id}
        AND outcome = 'created') = ${guard.createdCount}`
      // Only the rows that read as a whole suggestion (`suggestionFromStored`: a column one with its column, any other
      // with its row), the rows the judgement can have read: a stored row that is never shown is never counted, or
      // the import would read as busy for good.
      const suggestions = sql`(SELECT COUNT(*) FROM importSuggestion WHERE organizationId = ${org}
        AND importId = ${id} AND (CASE WHEN kind = 'column' THEN columnIndex IS NOT NULL
          ELSE rowId <> '' AND rowNumber IS NOT NULL END)) = ${guard.suggestionCount}`
      const items = sql`(SELECT COUNT(*) FROM item WHERE organizationId = ${org}
        AND skuKey IN (SELECT j.value FROM ${inList(org, guard.write, "keys")})) = ${guard.found}`
      return sql.and([
        items,
        eachThere(
          "items",
          sql`EXISTS (SELECT 1 FROM item i WHERE i.organizationId = w.organizationId
            AND i.id = json_extract(j.value, '$.id') AND i.revision = json_extract(j.value, '$.revision'))`
        ),
        created,
        eachThere(
          "created",
          sql`EXISTS (SELECT 1 FROM importOutcome o WHERE o.organizationId = w.organizationId
            AND o.importId = w.importId AND o.outcome = 'created'
            AND o.rowNumber = json_extract(j.value, '$.rowNumber') AND o.part = json_extract(j.value, '$.part'))`
        ),
        suggestions,
        eachThere(
          "suggestions",
          sql`EXISTS (SELECT 1 FROM importSuggestion s WHERE s.organizationId = w.organizationId
            AND s.importId = w.importId AND s.id = j.value)`
        )
      ])
    }

    // The draft is open, its column choices are still those the save's decisions were judged against, and the stored
    // items that judgement read are as read: a match or an item change since writes nothing of the save. Part of every
    // statement that writes it, so neither falls in between.
    const sameChoices = (org: string, id: string, choices: string, guard: typeof ItemsGuard.Encoded) =>
      sql`EXISTS (SELECT 1 FROM importDraft
      WHERE organizationId = ${org} AND id = ${id} AND status = 'open' AND choicesJson = ${choices})
      AND ${itemsAsRead(org, id, guard)}`
    // One save: the rows it sets and clears are its lists.
    const SaveWrite = S.Struct({ org: OrganizationId, id: S.String, choices: S.String, ...ItemsGuard.fields })
    // Bumps the revision only when the save changes something, before the writes below make it true.
    const bumpRevision = D1.statement({
      Request: SaveWrite,
      Result: NoRows,
      execute: (r) => sql`UPDATE importDraft SET revision = revision + 1
        WHERE organizationId = ${r.org} AND id = ${r.id} AND status = 'open' AND choicesJson = ${r.choices}
          AND ${itemsAsRead(r.org, r.id, r)} AND (${differs(r.org, r.write)} OR ${clears(r.org, r.id, r.write)})`
    })
    // Every stored row the save names was last saved by its sender, on the revision the draft is at before the save
    // moves it, whether or not the save changes it: a person who sends exactly what is stored decided the row too.
    // Before the revision is moved, so it reads the revision the save was made on.
    const touchDecisions = D1.statement({
      Request: S.Struct({ ...SaveWrite.fields, ...Acting }),
      Result: NoRows,
      execute: (r) => sql`UPDATE importDecision SET lastSavedById = ${r.actor},
          lastSavedRevision = (SELECT d.revision FROM importDraft d
            WHERE d.organizationId = ${r.org} AND d.id = ${r.id})
        WHERE organizationId = ${r.org} AND importId = ${r.id}
          AND rowId IN (SELECT json_extract(j.value, '$.rowId') FROM ${inList(r.org, r.write, "sets")})
          AND ${sameChoices(r.org, r.id, r.choices, r)}`
    })
    // One more save has named a row of the draft: what a save whose rows waited checks it was compared at.
    const countSave = D1.statement({
      Request: SaveWrite,
      Result: NoRows,
      execute: (r) => sql`UPDATE importDraft SET saves = saves + 1
        WHERE organizationId = ${r.org} AND id = ${r.id} AND status = 'open' AND choicesJson = ${r.choices}
          AND ${itemsAsRead(r.org, r.id, r)}
          AND (EXISTS (SELECT 1 FROM ${inList(r.org, r.write, "sets")})
            OR EXISTS (SELECT 1 FROM ${inList(r.org, r.write, "clears")}))`
    })
    const upsertDecisions = D1.statement({
      Request: S.Struct({ ...SaveWrite.fields, ...Acting, at: D1Instant }),
      Result: NoRows,
      // The same decision sent again leaves the row (who made it, and the revision it was saved at) as it is. Saved at
      // the revision this save moved the draft to, the statement before; a row new or changed moved it by one, so the
      // revision it was made on is one less.
      execute: (r) => sql`INSERT INTO importDecision (importId, organizationId, rowId, decisionJson, decidedById,
          decidedByName, updatedAt, savedRevision, lastSavedById, lastSavedRevision)
        SELECT ${r.id}, ${r.org}, json_extract(j.value, '$.rowId'), json_extract(j.value, '$.json'), a.actor,
          ${r.name}, ${r.at}, (SELECT d.revision FROM importDraft d
            WHERE d.organizationId = w.organizationId AND d.id = w.importId), a.actor,
          (SELECT d.revision - 1 FROM importDraft d WHERE d.organizationId = w.organizationId AND d.id = w.importId)
        FROM (SELECT ${r.actor} AS actor) AS a, ${inList(r.org, r.write, "sets")}
          AND ${sameChoices(r.org, r.id, r.choices, r)}
        ON CONFLICT (organizationId, importId, rowId) DO UPDATE SET decisionJson = excluded.decisionJson,
          decidedById = excluded.decidedById, decidedByName = excluded.decidedByName, updatedAt = excluded.updatedAt,
          savedRevision = excluded.savedRevision, lastSavedById = excluded.lastSavedById,
          lastSavedRevision = excluded.lastSavedRevision
        WHERE importDecision.decisionJson IS NOT excluded.decisionJson`
    })
    const clearDecisions = D1.statement({
      Request: SaveWrite,
      Result: NoRows,
      execute: (r) => sql`DELETE FROM importDecision WHERE organizationId = ${r.org} AND importId = ${r.id}
        AND rowId IN (SELECT j.value FROM ${inList(r.org, r.write, "clears")})
        AND ${sameChoices(r.org, r.id, r.choices, r)}`
    })
    const openRevision = D1.statement({
      Request: Scope,
      Result: S.Array(S.Struct({ revision: S.Int, saves: S.Int })),
      execute: (r) => sql`SELECT revision, saves FROM importDraft
        WHERE organizationId = ${r.org} AND id = ${r.id} AND status = 'open'`
    })

    // The open draft's revision and choices, and whether the stored items the save's judgement read are still so.
    const OpenChoices = S.Array(S.Struct({ revision: S.Int, saves: S.Int, choicesJson: S.String, itemsSame: S.Int }))
    const openChoices = D1.statement({
      Request: S.Struct({ ...Scope.fields, ...ItemsGuard.fields }),
      Result: OpenChoices,
      execute: (r) => sql`SELECT revision, saves, choicesJson,
          CASE WHEN ${itemsAsRead(r.org, r.id, r)} THEN 1 ELSE 0 END AS itemsSame
        FROM importDraft WHERE organizationId = ${r.org} AND id = ${r.id} AND status = 'open'`
    })

    const decide = Effect.fn("Imports.decide")(function* (
      actor: Member,
      draft: Draft,
      delta: DecisionDelta,
      read: ItemsAsRead = noItemsRead,
      expected: O.Option<ComparedAt> = O.none()
    ) {
      const at = yield* now
      const org = actor.organizationId
      const choices = draft.choicesJson
      const sets = yield* decisionPieces(delta.set)
      const cleared = yield* textPieces(delta.clear)
      const movedOn = (draftNow: { readonly revision: number; readonly saves: number }): boolean =>
        O.exists(expected, (compared) => compared.revision !== draftNow.revision || compared.saves !== draftNow.saves)
      if (sets.length + cleared.length === 0) {
        const open = yield* run(openRevision({ org, id: draft.id }))
        return O.match(A.head(open), {
          onNone: () => decisionsClosed,
          onSome: (row) => (movedOn(row) ? decisionsMoved : decisionsSaved({ revision: row.revision, changed: false }))
        })
      }
      const write = yield* random.uuidV4()
      const scope = { org, id: draft.id, write }
      const save = { ...scope, choices, ...guardOf(write, read) }
      const put = {
        ...scope,
        expected: O.getOrNull(O.map(expected, (at) => at.revision)),
        expectedSaves: O.getOrNull(O.map(expected, (at) => at.saves))
      }
      const reads = yield* putRead(scope, read)
      // The revision is read, then moved, and only for a delta that changes something; read again right after, it is
      // the revision these decisions are saved under, and a higher one than before says this save is what moved it.
      // The writes after it change no revision. One batch: nobody else's save can fall between the two reads, and
      // every write in it holds only while the choices and the stored items are those the save was judged against, and
      // writes from lists put only while the draft is at the revision its rows that waited were compared at, with no
      // other save since. Who last saved each row is written before the revision moves, so it reads the one the save
      // was made on; the count of saves after the first read, so that read is what the save was compared with.
      const answers = yield* batch([
        ...A.map(sets, (piece, seq) => putSets({ ...put, seq, piece })),
        ...A.map(cleared, (piece, seq) => putClears({ ...put, seq, piece })),
        ...reads,
        openChoices(save),
        touchDecisions({ ...save, ...acting(actor) }),
        bumpRevision(save),
        openChoices({ ...save, asked: 0 }),
        upsertDecisions({ ...save, ...acting(actor), at }),
        clearDecisions(save),
        countSave(save),
        dropLists({ org, write })
      ])
      // Only the two reads answer rows: the open draft's, before the revision was moved and after.
      const [before, after] = A.flatten(answers)
      return before === undefined || after === undefined
        ? decisionsClosed
        : before.choicesJson !== choices
          ? decisionsRematched
          : movedOn(before)
            ? decisionsMoved
            : before.itemsSame !== 1
              ? decisionsItemsChanged
              : decisionsSaved({ revision: after.revision, changed: after.revision > before.revision })
    }, Effect.orDie)

    const ReopenRequest = S.Struct({
      ...Acting,
      id: S.String,
      activity: S.String,
      detail: S.String,
      at: D1Instant
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
      at: D1Instant
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
          detail: `${draft.fileName}: ${rows}, ${O.isNone(draft.importedAt) ? "nothing had been imported" : "every item it created had been taken back"}`,
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
      return O.isSome(A.last(answers[8]))
    }, Effect.orDie)

    // -- Columns ---------------------------------------------------------------------------------------------------

    const choices = Effect.fn("Imports.choices")(function* (draft: Draft) {
      return yield* S.decodeEffect(ChoicesJson)(draft.choicesJson)
    }, Effect.orDie)

    const moves = Effect.fn("Imports.moves")(function* (draft: Draft) {
      return yield* S.decodeEffect(MovesJson)(draft.movesJson)
    }, Effect.orDie)

    const takenBack = Effect.fn("Imports.takenBack")(function* (draft: Draft) {
      return yield* S.decodeEffect(TakenBackJson)(draft.takenBackJson)
    }, Effect.orDie)

    const MatchRequest = S.Struct({
      ...Acting,
      id: S.String,
      revision: S.Int,
      before: S.String,
      activity: S.String,
      detail: S.String,
      at: D1Instant
    })
    // The audit line, written only while the import is open at the revision and with the choices the match was worked
    // out from, and the stored items its review read are as read. It is the match's own row: every statement after it
    // checks it, as a confirm's do, so a match worked out from anything that changed since writes nothing at all.
    const matchedLine = D1.statement({
      Request: S.Struct({ ...MatchRequest.fields, ...ItemsGuard.fields }),
      Result: NoRows,
      execute: (r) => sql`INSERT INTO activity (id, organizationId, actorId, actorName, action, detail, createdAt)
        SELECT ${r.activity}, ${r.org}, ${r.actor}, ${r.name}, 'Matched a column', ${r.detail}, ${r.at}
        WHERE EXISTS (SELECT 1 FROM importDraft WHERE organizationId = ${r.org} AND id = ${r.id} AND status = 'open'
          AND revision = ${r.revision} AND choicesJson = ${r.before})
          AND ${itemsAsRead(r.org, r.id, r)}`
    })
    const thisMatch = (org: string, activity: string) =>
      sql`EXISTS (SELECT 1 FROM activity WHERE organizationId = ${org} AND id = ${activity})`
    // The choices, the moves and what was taken back that the match leaves, at the revision it moves the draft to,
    // under the same condition and only when this batch wrote the match's audit line.
    const saveChoice = D1.statement({
      Request: S.Struct({ ...MatchRequest.fields, choices: ChoicesJson, moves: MovesJson, takenBack: TakenBackJson }),
      Result: Ids,
      execute: (r) => sql`UPDATE importDraft SET choicesJson = ${r.choices}, movesJson = ${r.moves},
          takenBackJson = ${r.takenBack}, revision = revision + 1
        WHERE organizationId = ${r.org} AND id = ${r.id} AND status = 'open' AND revision = ${r.revision}
          AND choicesJson = ${r.before} AND ${thisMatch(r.org, r.activity)}
        RETURNING id`
    })
    // The stored decisions the match takes back, as the match worked them out, whoever made them (who made them
    // stays); only when this batch wrote the match's audit line. Each entry of the piece finds its row by the key first
    // (the CROSS JOIN keeps that order, LIMIT -1 keeps the subquery whole), and the rows found are written by rowid:
    // a match that rewrites every row of a large file reads each row once a piece, never once for each entry.
    const rewriteDecisions = D1.statement({
      Request: S.Struct({ org: OrganizationId, id: S.String, activity: S.String, entries: piece(DecisionEntry) }),
      Result: NoRows,
      execute: (r) => sql`UPDATE importDecision SET decisionJson = e.json
        FROM (SELECT found.rowid AS at, json_extract(j.value, '$.json') AS json FROM json_each(${r.entries}) AS j
          CROSS JOIN importDecision AS found ON found.organizationId = ${r.org} AND found.importId = ${r.id}
            AND found.rowId = json_extract(j.value, '$.rowId') LIMIT -1) AS e
        WHERE importDecision.rowid = e.at AND importDecision.organizationId = ${r.org}
          AND ${thisMatch(r.org, r.activity)}`
    })

    const matchColumn = Effect.fn("Imports.matchColumn")(function* (
      actor: Member,
      draft: Draft,
      choice: { readonly field: Field; readonly column: number | null },
      detail: string,
      compare: CompareAtMatch = noComparison
    ) {
      const org = actor.organizationId
      // Worked out from the draft, its decisions and the stored items its review read, and written in one atomic batch
      // only while all of them are still as read: a save, a match or an item change that lands in between makes the
      // batch write nothing, and the match is worked out again, at most `draftTries` times (then `busy`).
      const attempt = (triesLeft: number): Effect.Effect<ChoicesSaved> =>
        Effect.gen(function* () {
          const found = yield* findDraft({ org, id: draft.id })
          if (O.isNone(found) || found.value.status !== "open") return "closed" as const
          const current = found.value
          const before = yield* S.decodeEffect(ChoicesJson)(current.choicesJson)
          // Choices that are already so are not a change: no audit line and no new revision.
          if (A.some(before, (old) => old.field === choice.field && old.column === choice.column)) {
            return "same" as const
          }
          const head = yield* S.decodeEffect(HeadJson)(current.headJson)
          const stored = yield* decisions(org, draft.id)
          const kept = yield* takenBack(current)
          const plan = yield* planMatch({
            head,
            choices: before,
            moves: yield* moves(current),
            decisions: stored.decisions,
            savedAt: stored.savedAt,
            choice,
            revision: current.revision,
            compare
          })
          const took = takenBackOfMatch({
            revision: plan.at,
            by: actor.name,
            matched: choice.field,
            reads: plan.reads,
            savedAt: stored.savedAt,
            notApplied: plan.notApplied
          })
          const at = yield* now
          const activity = yield* random.uuidV4()
          const request = {
            ...acting(actor),
            id: draft.id,
            revision: current.revision,
            before: current.choicesJson,
            activity,
            detail: `${detail}${takenBackWords(took)}`,
            at
          }
          const read = O.getOrElse(plan.read, () => noItemsRead)
          const reads = yield* putRead({ org, id: draft.id, write: activity }, read)
          const rewrites = yield* decisionPieces(plan.rewrites)
          const answers = yield* batch([
            ...reads,
            matchedLine({ ...request, ...guardOf(activity, read) }),
            saveChoice({
              ...request,
              choices: plan.choices,
              moves: plan.moves,
              takenBack: withTakeBacks({ kept, added: took })
            }),
            ...A.map(rewrites, (entries) => rewriteDecisions({ org, id: draft.id, activity, entries })),
            dropLists({ org, write: activity })
          ])
          // Only the draft's own update answers a row, and only when this batch was the match.
          if (A.flatten(answers).length > 0) return "saved" as const
          if (triesLeft <= 1) return "busy" as const
          return yield* attempt(triesLeft - 1)
        }).pipe(Effect.orDie)
      return yield* attempt(draftTries)
    }, Effect.orDie)

    const createdRows = Effect.fn("Imports.createdRows")(function* (organizationId: OrganizationId, importId: string) {
      return yield* findCreatedRows({ org: organizationId, id: importId })
    }, Effect.orDie)

    const storedAmong = Effect.fn("Imports.storedAmong")(function* (
      organizationId: OrganizationId,
      keys: ReadonlyArray<string>
    ) {
      // The keys travel as one JSON value per piece, each piece its own statement of two bound values.
      const pieces = yield* textPieces(keys)
      const found = yield* Effect.forEach(pieces, (some) => findStored({ org: organizationId, keys: some }), {
        concurrency: 1
      })
      return A.map(A.flatten(found), storedItem)
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

    const CommitScope = S.Struct({ ...Acting, id: S.String, batch: S.String, at: D1Instant })
    // The confirm's own row is written first, and only while the import is open at the revision the confirm was
    // made on; the import is closed next. Every statement after them checks that this confirm's row exists, so a
    // second confirm (a double click, a retry, another tab) finds the import closed, and a confirm made on a draft
    // somebody has changed since finds another revision, and a confirm whose judgement read stored items that changed
    // since finds them otherwise: each writes no row of its own, and so nothing at all.
    const insertBatch = D1.statement({
      Request: S.Struct({ ...CommitScope.fields, expected: S.Int, ...ItemsGuard.fields }),
      Result: Ids,
      execute: (r) => sql`INSERT INTO importBatch (id, organizationId, importId, confirmedById, confirmedByName,
          confirmedAt)
        SELECT ${r.batch}, ${r.org}, ${r.id}, ${r.actor}, ${r.name}, ${r.at}
        WHERE EXISTS (SELECT 1 FROM importDraft WHERE organizationId = ${r.org} AND id = ${r.id}
          AND status = 'open' AND revision = ${r.expected})
          AND ${itemsAsRead(r.org, r.id, r)}
        RETURNING id`
    })
    const thisConfirm = (org: string, batchId: string) =>
      sql`EXISTS (SELECT 1 FROM importBatch WHERE organizationId = ${org} AND id = ${batchId})`
    const closeDraft = D1.statement({
      Request: CommitScope,
      Result: Ids,
      // One revision on: a confirmed import is never taken for the open one of the same revision. What its matches
      // took back is let go: there is nothing left to name, and from this revision on it is kept again.
      execute: (r) => sql`UPDATE importDraft SET status = 'imported', revision = revision + 1,
          importedBy = ${r.name}, importedAt = ${r.at}, takenBackJson = '[]', takenBackFrom = revision + 1
        WHERE organizationId = ${r.org} AND id = ${r.id} AND status = 'open' AND ${thisConfirm(r.org, r.batch)}
        RETURNING id`
    })
    // The confirming person's own decisions not saved yet, under their name, in the confirm's own write: after the
    // confirm's row, so only the confirm that won writes them, and before the close.
    const saveAtConfirm = D1.statement({
      Request: S.Struct({ ...CommitScope.fields, entries: piece(DecisionEntry) }),
      Result: NoRows,
      // Saved at the revision the confirm moves the draft to when it closes it, after this.
      // Each row it names was last saved by the confirming person, on the revision the draft is at before the close,
      // changed or not; a changed one is theirs too.
      execute: (r) => sql`INSERT INTO importDecision (importId, organizationId, rowId, decisionJson, decidedById,
          decidedByName, updatedAt, savedRevision, lastSavedById, lastSavedRevision)
        SELECT ${r.id}, ${r.org}, json_extract(value, '$.rowId'), json_extract(value, '$.json'), ${r.actor}, ${r.name},
          ${r.at}, (SELECT d.revision + 1 FROM importDraft d WHERE d.organizationId = ${r.org} AND d.id = ${r.id}),
          ${r.actor}, (SELECT d.revision FROM importDraft d WHERE d.organizationId = ${r.org} AND d.id = ${r.id})
        FROM json_each(${r.entries}) WHERE ${thisConfirm(r.org, r.batch)}
        ON CONFLICT (organizationId, importId, rowId) DO UPDATE SET
          decidedById = CASE WHEN importDecision.decisionJson IS NOT excluded.decisionJson THEN excluded.decidedById
            ELSE importDecision.decidedById END,
          decidedByName = CASE WHEN importDecision.decisionJson IS NOT excluded.decisionJson THEN excluded.decidedByName
            ELSE importDecision.decidedByName END,
          updatedAt = CASE WHEN importDecision.decisionJson IS NOT excluded.decisionJson THEN excluded.updatedAt
            ELSE importDecision.updatedAt END,
          savedRevision = CASE WHEN importDecision.decisionJson IS NOT excluded.decisionJson THEN excluded.savedRevision
            ELSE importDecision.savedRevision END,
          decisionJson = excluded.decisionJson, lastSavedById = excluded.lastSavedById,
          lastSavedRevision = excluded.lastSavedRevision`
    })
    const clearAtConfirm = D1.statement({
      Request: S.Struct({ ...CommitScope.fields, rowIds: piece(S.String) }),
      Result: NoRows,
      execute: (r) => sql`DELETE FROM importDecision WHERE organizationId = ${r.org} AND importId = ${r.id}
        AND rowId IN (SELECT value FROM json_each(${r.rowIds})) AND ${thisConfirm(r.org, r.batch)}`
    })
    // One statement per 500 rows, the rows as one JSON value read with json_each: a handful of bound values a
    // statement however many rows it writes. A stored code is left as it is (ON CONFLICT DO NOTHING).
    const insertItems = D1.statement({
      Request: S.Struct({ ...CommitScope.fields, items: ItemsPiece }),
      Result: NoRows,
      execute: (r) => sql`INSERT INTO item (id, organizationId, sku, skuKey, name, description, category, uom,
          unitCost, quantityOnHand, reorderPoint, isActive, lotTracked, tags, firstReceivedOn, discontinuedOn,
          dimensions, vendors, importId, batchId, sourceRow, sourcePart, createdById, createdBy, createdAt)
        SELECT json_extract(value, '$.id'), ${r.org}, json_extract(value, '$.sku'), json_extract(value, '$.skuKey'),
          json_extract(value, '$.name'), json_extract(value, '$.description'), json_extract(value, '$.category'),
          json_extract(value, '$.uom'), json_extract(value, '$.unitCost'), json_extract(value, '$.quantityOnHand'),
          json_extract(value, '$.reorderPoint'), json_extract(value, '$.stocking.kind') = 'active',
          json_extract(value, '$.lotTracked'), json_extract(value, '$.tags'),
          json_extract(value, '$.firstReceivedOn'), json_extract(value, '$.stocking.on'),
          json_extract(value, '$.dimensions'), json_extract(value, '$.vendors'), ${r.id},
          ${r.batch}, json_extract(value, '$.rowNumber'), json_extract(value, '$.part'), ${r.actor}, ${r.name}, ${r.at}
        FROM json_each(${r.items}) WHERE ${thisConfirm(r.org, r.batch)}
        ON CONFLICT (organizationId, skuKey) DO NOTHING`
    })
    // Before a replace, in the same batch: the stored item as it is, so a take-back of this confirm can put it back.
    // revisionAfter is the revision the replace below gives it; one copy per item, however many rows name it. CROSS JOIN
    // keeps the order written: each row of the piece finds its item by the SKU's index. Left to choose, SQLite reads every
    // item of the organization and scans the piece for each, which at 50,000 items takes minutes.
    const keepReplaced = D1.statement({
      Request: S.Struct({ ...CommitScope.fields, items: ItemsPiece }),
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
        CROSS JOIN item i ON i.organizationId = ${r.org} AND i.skuKey = json_extract(j.value, '$.skuKey')
        WHERE ${thisConfirm(r.org, r.batch)}
        ON CONFLICT (organizationId, batchId, itemId) DO NOTHING`
    })
    // A stored item the person chose to replace with the file's row: every value but its SKU and its origin is
    // written over, and its revision goes up, so the import that created it can no longer take it back. Found as the copy
    // above finds it (LIMIT -1 keeps the subquery whole), then written by its rowid.
    const replaceItems = D1.statement({
      Request: S.Struct({ ...CommitScope.fields, items: ItemsPiece }),
      Result: NoRows,
      execute: (r) => sql`UPDATE item SET name = json_extract(e.value, '$.name'),
          description = json_extract(e.value, '$.description'), category = json_extract(e.value, '$.category'),
          uom = json_extract(e.value, '$.uom'), unitCost = json_extract(e.value, '$.unitCost'),
          quantityOnHand = json_extract(e.value, '$.quantityOnHand'),
          reorderPoint = json_extract(e.value, '$.reorderPoint'),
          isActive = json_extract(e.value, '$.stocking.kind') = 'active',
          lotTracked = json_extract(e.value, '$.lotTracked'), tags = json_extract(e.value, '$.tags'),
          firstReceivedOn = json_extract(e.value, '$.firstReceivedOn'),
          discontinuedOn = json_extract(e.value, '$.stocking.on'),
          dimensions = json_extract(e.value, '$.dimensions'), vendors = json_extract(e.value, '$.vendors'),
          revision = item.revision + 1, updatedById = ${r.actor}, updatedBy = ${r.name}, updatedAt = ${r.at}
        FROM (SELECT found.rowid AS at, j.value AS value FROM json_each(${r.items}) AS j
          CROSS JOIN item AS found ON found.organizationId = ${r.org} AND found.skuKey = json_extract(j.value, '$.skuKey')
          LIMIT -1) AS e
        WHERE item.rowid = e.at AND item.organizationId = ${r.org} AND ${thisConfirm(r.org, r.batch)}`
    })
    // A row counts as created only if its item is really there: a ready row whose code someone else stored in the
    // meantime is reported as already there, never as created. A row an earlier confirm created is created still.
    const landed = (org: string, id: string) => sql`EXISTS (SELECT 1 FROM item r WHERE r.organizationId = ${org}
      AND r.importId = ${id} AND r.sourceRow = json_extract(value, '$.rowNumber')
      AND r.sourcePart = json_extract(value, '$.part'))`
    const insertOutcomes = D1.statement({
      Request: S.Struct({ ...CommitScope.fields, outcomes: piece(OutcomeInsert) }),
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
      Request: S.Struct({ ...CommitScope.fields, changes: piece(ChangeInsert) }),
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

    const commit = Effect.fn("Imports.commit")(function* (write: ConfirmWrite) {
      const audit = lineOf(write.audit)
      const scope = {
        org: audit.org,
        actor: audit.actor,
        name: audit.name,
        id: write.draft,
        batch: write.confirm,
        at: audit.at
      }
      const rows = write.plan.rows
      const written = plannedItems(write.plan)
      const ready = A.filter(written, PlannedRow.guards.ready)
      const replacing = A.filter(written, PlannedRow.guards.update)
      const entries = (list: ReadonlyArray<readonly [(typeof written)[number], string]>) =>
        itemPieces(
          A.map(list, ([row, id]) => ({
            ...row.item,
            id,
            rowNumber: row.rowNumber,
            part: row.part
          }))
        )
      const items = yield* entries(A.zip(ready, write.itemIds))
      const replacements = yield* entries(A.map(replacing, (row) => [row, ""] as const))
      // What the outcome rows store: the reason of a row that is not written, and who left it out.
      const reasonOf = (row: PlannedRow): string =>
        PlannedRow.guards.already(row) || PlannedRow.guards.notImported(row) ? row.reason : ""
      const decidedBy = (row: PlannedRow): "person" | "nobody" | null =>
        PlannedRow.guards.notImported(row) ? row.decidedBy.kind : null
      const decidedByName = (row: PlannedRow): string | null =>
        PlannedRow.guards.notImported(row) && DecidedBy.guards.person(row.decidedBy) ? row.decidedBy.name : null
      const outcomes = yield* outcomePieces(
        A.map(rows, (row) => ({
          rowNumber: row.rowNumber,
          part: row.part,
          sku: row.sku,
          name: row.name,
          status: row.status,
          reason: reasonOf(row),
          decidedBy: decidedBy(row),
          decidedByName: decidedByName(row)
        }))
      )
      const changes = yield* changePieces(
        A.flatMap(written, (row) =>
          A.map(row.changes, (entry) => ({
            ...changeToStored(entry.change),
            decidedByName: O.getOrNull(entry.decidedByName),
            rowNumber: row.rowNumber,
            part: row.part,
            sku: row.sku,
            update: PlannedRow.guards.update(row)
          }))
        )
      )
      const lists = { org: audit.org, id: write.draft, write: write.confirm }
      const reads = yield* putRead(lists, write.read)
      const unsaved = yield* decisionPieces(write.unsaved.set)
      const cleared = yield* textPieces(write.unsaved.clear)
      const answers = yield* batch([
        ...reads,
        insertBatch({ ...scope, expected: write.expected, ...guardOf(write.confirm, write.read) }),
        ...A.map(unsaved, (entries) => saveAtConfirm({ ...scope, entries })),
        ...A.map(cleared, (rowIds) => clearAtConfirm({ ...scope, rowIds })),
        closeDraft(scope),
        ...A.map(items, (chunk) => insertItems({ ...scope, items: chunk })),
        ...A.map(replacements, (chunk) => keepReplaced({ ...scope, items: chunk })),
        ...A.map(replacements, (chunk) => replaceItems({ ...scope, items: chunk })),
        ...A.map(outcomes, (chunk) => insertOutcomes({ ...scope, outcomes: chunk })),
        ...A.map(changes, (chunk) => insertChanges({ ...scope, changes: chunk })),
        countBatch(scope),
        importedLine({ ...scope, activity: audit.id, fileName: write.fileName }),
        dropLists(lists)
      ])
      // Only the confirm's own row and the close answer one, and only when this batch confirmed the import.
      if (A.flatten(answers).length > 0) return confirmWritten
      // Nothing was written. Still open at another revision: the draft moved on. Still open at the revision the confirm
      // was made on: a stored item its judgement read changed (revisions only go up, so the draft never came back).
      const open = yield* run(openRevision({ org: audit.org, id: write.draft }))
      return O.match(A.head(open), {
        onNone: () => confirmClosed,
        onSome: (row) => (row.revision === write.expected ? confirmItemsChanged : confirmMoved(row.revision))
      })
    }, Effect.orDie)

    // -- Taking a confirm back -----------------------------------------------------------------------------

    const TakeBackScope = S.Struct({
      ...Acting,
      id: S.String,
      takeBack: S.String,
      confirms: IdList,
      at: D1Instant
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

    const takeBack = Effect.fn("Imports.takeBack")(function* (write: TakeBackWrite) {
      const audit = lineOf(write.audit)
      const confirms = write.confirms
      const scope = {
        org: audit.org,
        actor: audit.actor,
        name: audit.name,
        id: write.draft,
        takeBack: write.takeBack,
        confirms,
        at: audit.at
      }
      // One restore pass per confirm asked for (at most 10): enough for an item each of them replaced in turn.
      const passes = A.flatMap(A.range(1, Math.min(Math.max(confirms.length, 1), 10)), () => [
        flagRestorable(scope),
        restoreItems(scope)
      ])
      const [marked] = yield* batch([
        markConfirms(scope),
        ...passes,
        countTakeBack(scope),
        takenBackLine({ ...scope, activity: audit.id, fileName: write.fileName }),
        markOutcomes(scope),
        markReplacedOutcomes(scope),
        removeItems(scope),
        settleDraft(scope)
      ])
      return marked.length > 0 ? tookBack : nothingInForce
    }, Effect.orDie)

    const history = Effect.fn("Imports.history")(function* (organizationId: OrganizationId, importId: string) {
      const confirms = yield* findBatches({ org: organizationId, id: importId })
      // One take-back can reverse several confirms of the import. It is one event, and its numbers are the sums
      // over every confirm it reversed, so "removed" is every item that take-back removed, not the last confirm's.
      const sameTakeBack = (row: (typeof confirms)[number]) =>
        A.filter(confirms, (other) => other.takeBackId !== null && other.takeBackId === row.takeBackId)
      const firstOf = (row: (typeof confirms)[number]): boolean => sameTakeBack(row)[0]?.id === row.id
      const events = A.flatMap(confirms, (row): ReadonlyArray<ImportEvent> => [
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
        ...(O.isNone(row.takenBackAt) || O.isNone(row.takenBackByName) || !firstOf(row)
          ? []
          : [
              ImportEvent.cases.TakenBack.make({
                batchId: row.id,
                by: row.takenBackByName.value,
                at: row.takenBackAt.value,
                removed: A.reduce(sameTakeBack(row), 0, (total, other) => total + other.removed),
                restored: A.reduce(sameTakeBack(row), 0, (total, other) => total + other.restored),
                kept: A.reduce(sameTakeBack(row), 0, (total, other) => total + other.kept)
              })
            ])
      ])
      return A.sort(
        events,
        Order.mapInput(DateTime.Order, (event: ImportEvent) => event.at)
      )
    }, Effect.orDie)

    // What a take-back would do now: four reads in one batch, so they describe the same moment.
    const inForce = (org: string, id: string) => sql`(SELECT id FROM importBatch
      WHERE organizationId = ${org} AND importId = ${id} AND takeBackId IS NULL)`
    const confirmsInForce = D1.statement({
      Request: Scope,
      Result: S.Array(S.Struct({ id: ConfirmId })),
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
        A.map(A.take(rows, changedItemsShown), (row) =>
          ChangedItem.make({
            sku: row.sku,
            name: row.name,
            changedBy: row.changedBy,
            changedAt: row.changedAt
          })
        )
      return {
        confirms: A.map(confirms, (row) => row.id),
        removable: O.match(A.head(removable), { onNone: () => 0, onSome: (row) => row.n }),
        restorable: O.match(A.head(restorable), { onNone: () => 0, onSome: (row) => row.n }),
        changed: named(changed),
        changedCount: changed.length,
        kept: named(kept),
        keptCount: kept.length
      }
    }, Effect.orDie)

    return ImportStore.of({
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
      moves,
      takenBack,
      matchColumn,
      createdRows,
      changes: Effect.fn("Imports.changes")(function* (organizationId: OrganizationId) {
        const rows = yield* findChanges(organizationId).pipe(Effect.orDie)
        return A.map(rows, (row): ChangeRecord => ({
          importId: row.importId,
          fileName: row.fileName,
          rowNumber: row.rowNumber,
          // Stored as 0 for a row that is one item, which the answer leaves out.
          part: row.part === 0 ? O.none() : O.some(row.part),
          sku: row.sku,
          change: changeFromStored(row),
          decidedByName: O.fromNullOr(row.decidedByName),
          createdAt: row.createdAt,
          takenBack: row.takenBack
        }))
      }),
      find: Effect.fn("Imports.find")(function* (organizationId: OrganizationId, id: string) {
        return yield* findDraft({ org: organizationId, id }).pipe(Effect.orDie)
      }),
      outcomes: Effect.fn("Imports.outcomes")(function* (organizationId: OrganizationId, importId: string) {
        const rows = yield* findOutcomes({ org: organizationId, id: importId }).pipe(Effect.orDie)
        return A.map(rows, (row) =>
          outcomeOf({
            rowNumber: row.rowNumber,
            // Stored as 0 for a row that is one item, which the answer leaves out.
            part: row.part === 0 ? O.none() : O.some(row.part),
            sku: row.sku,
            name: row.name,
            outcome: row.outcome,
            reason: row.reason,
            decidedBy: whoDecided(row)
          })
        )
      }),
      items: Effect.fn("Imports.items")(function* (organizationId: OrganizationId) {
        return yield* findItems(organizationId).pipe(Effect.map(A.map(storedItem)), Effect.orDie)
      })
    })
  })
).pipe(Layer.provide(SecureRandom.layerWebCrypto))
