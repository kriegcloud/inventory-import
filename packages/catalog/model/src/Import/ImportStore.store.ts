// What the catalog keeps about imports, as its handlers ask for it: uploads and their pieces, drafts and their
// decisions, the confirm and the take-back (each one atomic write), and what is read back from what they stored.
// The one thing not to break: nothing here says how it is stored. The D1 adapter is in `catalog-host`.
import * as S from "effect/Schema"
import { ImportId, ConfirmId, ItemId } from "@inventory/catalog-contract/Ids"
import { Instant } from "@inventory/kernel/Text"
import { StoredItem } from "@inventory/catalog-contract/Item"
import { SavedDecisions, DecisionDelta } from "@inventory/catalog-contract/Decision"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Result from "effect/Result"
import * as Tuple from "effect/Tuple"
import { Member } from "@inventory/kernel/Member"
import { StagedHead, StagedRow, StagedTable } from "@inventory/catalog-contract/Staged"
import { FileProblem } from "@inventory/catalog-contract/FileProblem"
import { OrganizationId } from "@inventory/kernel/Ids"
import { PastImport, ChangeRecord, ImportEvent, TakeBackState, RowOutcome } from "@inventory/catalog-contract/Import"
import { MappingChoice } from "@inventory/catalog-contract/Mapping"
import { ConfirmPlan } from "../Confirm/Confirm.rules.ts"
import { Activity } from "@inventory/kernel/Activity"
import { LiteralKit } from "@beep/schema/LiteralKit"

/** An import as stored, without its rows. */
export const Draft = S.Struct({
  id: ImportId,
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

/** One confirm, as it is written: its plan, the ids its new items take, and its audit line, in one atomic batch. */
export class ConfirmWrite extends S.Opaque<ConfirmWrite, { readonly brand: unique symbol }>()(
  S.Struct({
    draft: ImportId,
    fileName: S.String.pipe(S.annotateKey({ description: "The import's file, for the audit line" })),
    confirm: ConfirmId,
    plan: ConfirmPlan,
    itemIds: S.Array(ItemId).pipe(
      S.annotateKey({ description: "One id per row the plan creates, in the plan's order, made by the handler" })
    ),
    audit: Activity.pipe(
      S.annotateKey({ description: '"Imported items": its detail is filled in by the batch from what it counted' })
    )
  }).annotate({ identifier: "ConfirmWrite", description: "One confirm of an import, as it is written" })
) {}

/** What a confirm's write did. */
export const ConfirmedKind = LiteralKit(["confirmed", "closed"]).annotate({
  identifier: "ConfirmedKind",
  description: "The confirm was written, or the import was no longer open and nothing was"
})
class ConfirmWritten extends S.Opaque<ConfirmWritten, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("confirmed") }).annotate({
    identifier: "ConfirmWritten",
    description: "This write confirmed the import"
  })
) {}
class ConfirmClosed extends S.Opaque<ConfirmClosed, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("closed") }).annotate({
    identifier: "ConfirmClosed",
    description: "Another confirm won, or the import was not open: nothing was written"
  })
) {}
/** Whether a confirm's write was the one that confirmed the import. */
export const Confirmed = ConfirmedKind.mapMembers(() => Tuple.make(ConfirmWritten, ConfirmClosed)).pipe(
  S.toTaggedUnion("kind"),
  S.annotate({ identifier: "Confirmed", description: "Whether a confirm's write confirmed the import" })
)
/** The decoded value of `Confirmed`. */
export type Confirmed = typeof Confirmed.Type
/** This write confirmed the import. */
export const confirmWritten: Confirmed = ConfirmWritten.make({})
/** The import was no longer open: nothing was written. */
export const confirmClosed: Confirmed = ConfirmClosed.make({})

/** One take-back, as it is written: the confirms it reverses and its audit line, in one atomic batch. */
export class TakeBackWrite extends S.Opaque<TakeBackWrite, { readonly brand: unique symbol }>()(
  S.Struct({
    draft: ImportId,
    fileName: S.String.pipe(S.annotateKey({ description: "The import's file, for the audit line" })),
    takeBack: S.String.check(S.isUUID()).pipe(S.annotateKey({ description: "This take-back's own id" })),
    confirms: S.Array(ConfirmId).pipe(
      S.annotateKey({ description: "The confirms the person was shown; only those still in force are reversed" })
    ),
    audit: Activity.pipe(
      S.annotateKey({ description: '"Took back an import": its detail is filled in by the batch from what it counted' })
    )
  }).annotate({ identifier: "TakeBackWrite", description: "One take-back of an import, as it is written" })
) {}

/** What a take-back's write did. */
export const TookBackKind = LiteralKit(["tookBack", "nothingInForce"]).annotate({
  identifier: "TookBackKind",
  description: "Confirms were taken back, or none of those named was in force any more"
})
class TakenBack extends S.Opaque<TakenBack, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("tookBack") }).annotate({
    identifier: "TakenBack",
    description: "At least one of the confirms was in force and is taken back"
  })
) {}
class NothingInForce extends S.Opaque<NothingInForce, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("nothingInForce") }).annotate({
    identifier: "NothingInForce",
    description: "None of the confirms was in force any more (a second press): nothing was written"
  })
) {}
/** Whether a take-back's write reversed anything. */
export const TookBack = TookBackKind.mapMembers(() => Tuple.make(TakenBack, NothingInForce)).pipe(
  S.toTaggedUnion("kind"),
  S.annotate({ identifier: "TookBack", description: "Whether a take-back's write reversed anything" })
)
/** The decoded value of `TookBack`. */
export type TookBack = typeof TookBack.Type
/** At least one confirm was taken back. */
export const tookBack: TookBack = TakenBack.make({})
/** None of the confirms was in force any more. */
export const nothingInForce: TookBack = NothingInForce.make({})

/** The saved draft of a review, and who last decided each row. */
export type StoredDecisions = {
  readonly decisions: SavedDecisions
  readonly authors: Readonly<Record<string, string>>
}

/** What saving the column choices did: saved them, found them already so (nothing written), or found the import closed. */
export type ChoicesSaved = "saved" | "same" | "closed"

/** An upload that has not finished: who started it, what file, and how many rows in how many pieces will follow. */
export const Upload = S.Struct({
  id: ImportId,
  fileName: S.String,
  headJson: S.String,
  rowCount: S.Int,
  chunkCount: S.Int
}).annotate({ description: "An unfinished upload, without its pieces" })
/** The decoded value of `Upload`: an upload that has not finished. */
export type Upload = typeof Upload.Type

/** Data access for imports and the items they create. */
export class ImportStore extends Context.Service<
  ImportStore,
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
    ): Effect.Effect<Result.Result<ImportId, FileProblem>>
    /** The caller's own unfinished upload with this id. Another member's, or one that finished, is none. */
    findUpload(actor: Member, id: string): Effect.Effect<O.Option<Upload>>
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
    find(organizationId: OrganizationId, id: string): Effect.Effect<O.Option<Draft>>
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
    decide(actor: Member, draft: Draft, delta: DecisionDelta): Effect.Effect<O.Option<number>>
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
     * Writes a confirm: its new items, the stored items it replaces (each with a kept copy), every row's outcome,
     * the changed values and the audit line, in one atomic batch. `closed` when the import was no longer open, in
     * which case nothing was written.
     */
    commit(write: ConfirmWrite): Effect.Effect<Confirmed>
    /**
     * Takes back the confirms named that are still in force, in one atomic batch: removes their items nobody has
     * changed since, puts back the stored items they replaced that nobody has changed since, keeps the ones someone
     * changed, marks the rows of the removed and restored items, records who took them back with the counts, and
     * writes the audit line. `nothingInForce`, having written nothing, when none of them is in force any more.
     */
    takeBack(write: TakeBackWrite): Effect.Effect<TookBack>
    /** Every confirm and take-back of the import, oldest first, with the numbers they stored. */
    history(organizationId: OrganizationId, importId: string): Effect.Effect<ReadonlyArray<ImportEvent>>
    /** What taking the import back would do now, read from the items and confirms as stored. */
    takeBackState(organizationId: OrganizationId, importId: string): Effect.Effect<TakeBackState>
    /** What the confirms did with each row of the file, by row. */
    outcomes(organizationId: OrganizationId, importId: string): Effect.Effect<ReadonlyArray<RowOutcome>>
    /** Every item of the organization, by SKU. */
    items(organizationId: OrganizationId): Effect.Effect<ReadonlyArray<StoredItem>>
  }
>()("@inventory/catalog-model/Import/ImportStore.store/ImportStore") {}
