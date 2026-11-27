// What the catalog keeps about imports, as its handlers ask for it: uploads and their pieces, drafts and their
// decisions, the confirm and the take-back (each one atomic write), and what is read back from what they stored.
// The one thing not to break: nothing here says how it is stored. The D1 adapter is in `catalog-host`.
import * as A from "effect/Array"
import * as S from "effect/Schema"
import { ImportId, ConfirmId, ItemId, type UploadKey } from "@inventory/catalog-contract/Ids"
import { Instant } from "@inventory/kernel/Text"
import { StoredItem } from "@inventory/catalog-contract/Item"
import { SavedDecisions, DecisionDelta } from "@inventory/catalog-contract/Decision"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Result from "effect/Result"
import * as Tuple from "effect/Tuple"
import { Member } from "@inventory/kernel/Member"
import { type Field, StagedHead, StagedRow, StagedTable } from "@inventory/catalog-contract/Staged"
import { FileProblem } from "@inventory/catalog-contract/FileProblem"
import { OrganizationId } from "@inventory/kernel/Ids"
import {
  PastImport,
  ChangeRecord,
  ImportEvent,
  type MatchTakeBack,
  TakeBackState,
  RowOutcome
} from "@inventory/catalog-contract/Import"
import { ColumnMove, MappingChoice } from "@inventory/catalog-contract/Mapping"
import { ConfirmPlan, PlannedRow } from "../Confirm/Confirm.rules.ts"
import { type CompareAtMatch, ItemsAsRead } from "./Rematch.rules.ts"
import { Activity } from "@inventory/kernel/Activity"
import { LiteralKit } from "@beep/schema/LiteralKit"

/**
 * Where a stored import stands: still open to review, imported by a confirm, or taken back after one. The same list
 * as the contract's import status, so the stored column and the wire keep one set of words.
 */
export const DraftStatus = LiteralKit(["open", "imported", "takenBack"]).annotate({
  identifier: "DraftStatus",
  description: "Where a stored import stands: open, imported, or taken back"
})
/** The decoded value of `DraftStatus`. */
export type DraftStatus = typeof DraftStatus.Type

/**
 * Which of an organization's imports a list asks for: whose they are and how many at most. One named argument, not
 * two in a row: a list has no value it acts on, so `limit` is never mistaken for one.
 */
export const ImportListQuery = S.Struct({
  organizationId: OrganizationId.pipe(S.annotateKey({ description: "The organization whose imports are listed" })),
  limit: S.Int.pipe(S.annotateKey({ description: "The most imports the list returns" }))
}).annotate({
  identifier: "ImportListQuery",
  description: "Which of an organization's imports a list asks for, and how many at most"
})
/** {@link ImportListQuery}, as a list is asked. */
export type ImportListQuery = typeof ImportListQuery.Type

/** An import as stored, without its rows. */
export const Draft = S.Struct({
  id: ImportId,
  fileName: S.String,
  headJson: S.String,
  rowCount: S.Int,
  status: DraftStatus,
  actorName: S.String,
  createdAt: Instant,
  importedBy: S.OptionFromNullOr(S.String),
  importedAt: S.OptionFromNullOr(Instant),
  revision: S.Int,
  needsAtStart: S.Int,
  choicesJson: S.String,
  movesJson: S.String.annotateKey({
    description: "Every field that began to read another column at a match, oldest first: `ColumnMove`s as JSON"
  }),
  takenBackJson: S.String.annotateKey({
    description:
      "What each match of the open import took back from the stored decisions, oldest first: `MatchTakeBack`s as JSON; '[]' once it is confirmed"
  }),
  takenBackFrom: S.Int.annotateKey({
    description:
      "The revision from which `takenBackJson` holds what every match took back: 0 for an import created since it was kept, the confirm's revision after a confirm let them go. A match at or before it took back what no entry says"
  })
}).annotate({ description: "An import as stored, without its rows" })
/** The decoded value of `Draft`: an import as stored, without its rows. */
export type Draft = typeof Draft.Type

/** One confirm, as it is written: its plan, the ids its new items take, and its audit line, in one atomic batch. */
export class ConfirmWrite extends S.Opaque<ConfirmWrite, { readonly brand: unique symbol }>()(
  S.Struct({
    draft: ImportId,
    fileName: S.String.pipe(S.annotateKey({ description: "The import's file, for the audit line" })),
    confirm: ConfirmId,
    expected: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
      S.annotateKey({
        description:
          "The draft's revision the plan was worked out from: the confirm is written only while the draft is still at it"
      })
    ),
    unsaved: DecisionDelta.pipe(
      S.annotateKey({
        description:
          "The confirming person's own decisions not saved yet, already in the plan: saved under their name in the same write"
      })
    ),
    // The stored items, created rows and suggestions the confirm's judgement of its decisions across a re-match read:
    // the confirm is written only while they are still so. Given as the class itself, which an annotation would
    // rebuild into a plain struct.
    read: ItemsAsRead,
    plan: ConfirmPlan,
    itemIds: S.Array(ItemId).pipe(
      S.annotateKey({ description: "One id per row the plan creates, in the plan's order, made by the handler" })
    ),
    audit: Activity.pipe(
      S.annotateKey({ description: "\"Imported items\": its detail is filled in by the batch from what it counted" })
    )
  })
    // A store pairs the rows the plan creates with the ids in order, and a pairing stops at the shorter list: with
    // an id missing, a ready row would be left out of the write without a word.
    .check(
      S.makeFilter((write) => write.itemIds.length === A.filter(write.plan.rows, PlannedRow.guards.ready).length, {
        description: "One id for each row the plan creates"
      })
    )
    .annotate({ identifier: "ConfirmWrite", description: "One confirm of an import, as it is written" })
) {
}

/** What a confirm's write did. */
export const ConfirmedKind = LiteralKit(["confirmed", "closed", "moved", "itemsChanged"]).annotate({
  identifier: "ConfirmedKind",
  description:
    "The confirm was written; or nothing was, because the import was no longer open, because its draft had moved on from the revision the confirm was made on, or because a stored item its judgement read changed since"
})

class ConfirmWritten extends S.Opaque<ConfirmWritten, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("confirmed") }).annotate({
    identifier: "ConfirmWritten",
    description: "This write confirmed the import"
  })
) {
}

class ConfirmClosed extends S.Opaque<ConfirmClosed, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("closed") }).annotate({
    identifier: "ConfirmClosed",
    description: "Another confirm won, or the import was not open: nothing was written"
  })
) {
}

class ConfirmMoved extends S.Opaque<ConfirmMoved, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("moved"),
    revision: S.Int.pipe(S.annotateKey({ description: "The draft's revision now" }))
  }).annotate({
    identifier: "ConfirmMoved",
    description: "The draft is open at another revision than the confirm was made on: nothing was written"
  })
) {
}

class ConfirmItemsChanged extends S.Opaque<ConfirmItemsChanged, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("itemsChanged") }).annotate({
    identifier: "ConfirmItemsChanged",
    description:
      "A stored item the confirm's judgement read was edited, replaced, created or taken back since, or the import's created rows or suggestions changed: nothing was written, and the confirm is judged again"
  })
) {
}

/**
 * Whether a confirm's write was the one that confirmed the import. Told apart with `Confirmed.match` or its `guards`:
 * the description is given before `S.toTaggedUnion`, since annotating after it rebuilds the union without them.
 */
export const Confirmed = ConfirmedKind.mapMembers(() =>
  Tuple.make(ConfirmWritten, ConfirmClosed, ConfirmMoved, ConfirmItemsChanged)
).pipe(
  S.annotate({ identifier: "Confirmed", description: "Whether a confirm's write confirmed the import" }),
  S.toTaggedUnion("kind")
)
/** The decoded value of `Confirmed`. */
export type Confirmed = typeof Confirmed.Type
/** This write confirmed the import. */
export const confirmWritten: Confirmed = ConfirmWritten.make({})
/** The import was no longer open: nothing was written. */
export const confirmClosed: Confirmed = ConfirmClosed.make({})
/** The draft had moved on to `revision`: nothing was written. */
export const confirmMoved = (revision: number): Confirmed => ConfirmMoved.make({ revision })
/** A stored item, created row or suggestion the confirm's judgement read changed since: nothing was written. */
export const confirmItemsChanged: Confirmed = ConfirmItemsChanged.make({})

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
      S.annotateKey({ description: "\"Took back an import\": its detail is filled in by the batch from what it counted" })
    )
  }).annotate({ identifier: "TakeBackWrite", description: "One take-back of an import, as it is written" })
) {
}

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
) {
}

class NothingInForce extends S.Opaque<NothingInForce, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("nothingInForce") }).annotate({
    identifier: "NothingInForce",
    description: "None of the confirms was in force any more (a second press): nothing was written"
  })
) {
}

/** Whether a take-back's write reversed anything. */
export const TookBack = TookBackKind.mapMembers(() => Tuple.make(TakenBack, NothingInForce)).pipe(
  S.annotate({ identifier: "TookBack", description: "Whether a take-back's write reversed anything" }),
  S.toTaggedUnion("kind")
)
/** The decoded value of `TookBack`. */
export type TookBack = typeof TookBack.Type
/** At least one confirm was taken back. */
export const tookBack: TookBack = TakenBack.make({})
/** None of the confirms was in force any more. */
export const nothingInForce: TookBack = NothingInForce.make({})

/** What a save of decisions did. */
export const DecidedKind = LiteralKit(["saved", "closed", "rematched", "moved", "itemsChanged"]).annotate({
  identifier: "DecidedKind",
  description:
    "The save was written; or nothing was, because the import was no longer open, because a column was matched again since the choices its decisions were judged against, because the draft moved on from the revision its rows that waited were compared at, or because a stored item that judgement read changed since"
})

class DecisionsSaved extends S.Opaque<DecisionsSaved, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("saved"),
    revision: S.Int.pipe(S.annotateKey({ description: "The draft's revision after the save" })),
    changed: S.Boolean.pipe(S.annotateKey({ description: "Whether this save is what moved the draft there" }))
  }).annotate({ identifier: "DecisionsSaved", description: "The save was written, or changed nothing" })
) {
}

class DecisionsClosed extends S.Opaque<DecisionsClosed, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("closed") }).annotate({
    identifier: "DecisionsClosed",
    description: "The import was no longer open: nothing was saved"
  })
) {
}

class DecisionsRematched extends S.Opaque<DecisionsRematched, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("rematched") }).annotate({
    identifier: "DecisionsRematched",
    description:
      "A column was matched again since the draft was read: its decisions were judged against choices it no longer has, and nothing was saved"
  })
) {
}

class DecisionsMoved extends S.Opaque<DecisionsMoved, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("moved") }).annotate({
    identifier: "DecisionsMoved",
    description:
      "The draft moved on from the revision the save's rows that waited were compared at (somebody saved, matched or confirmed in between): nothing was saved"
  })
) {
}

class DecisionsItemsChanged extends S.Opaque<DecisionsItemsChanged, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("itemsChanged") }).annotate({
    identifier: "DecisionsItemsChanged",
    description:
      "A stored item the save's judgement of a Replace or Keep-stored read was edited, replaced, created or taken back since, or the import's created rows or suggestions changed: nothing was saved"
  })
) {
}

/**
 * What a save of decisions did: written (at which revision, and whether it moved the draft), or why not. Told apart
 * with `Decided.match` or its `guards`.
 */
export const Decided = DecidedKind.mapMembers(() =>
  Tuple.make(DecisionsSaved, DecisionsClosed, DecisionsRematched, DecisionsMoved, DecisionsItemsChanged)
).pipe(S.annotate({ identifier: "Decided", description: "What a save of decisions did" }), S.toTaggedUnion("kind"))
/** The decoded value of `Decided`. */
export type Decided = typeof Decided.Type
/** The save was written at `revision`; `changed` says whether it is what moved the draft there. */
export const decisionsSaved = (saved: { readonly revision: number; readonly changed: boolean }): Decided =>
  DecisionsSaved.make(saved)
/** The import was no longer open: nothing was saved. */
export const decisionsClosed: Decided = DecisionsClosed.make({})
/** A column was matched again since the draft was read: nothing was saved. */
export const decisionsRematched: Decided = DecisionsRematched.make({})
/** The draft moved on from the revision the save's rows that waited were compared at: nothing was saved. */
export const decisionsMoved: Decided = DecisionsMoved.make({})
/** A stored item, created row or suggestion the save's judgement read changed since: nothing was saved. */
export const decisionsItemsChanged: Decided = DecisionsItemsChanged.make({})

/**
 * The saved draft of a review, who last decided each row, and the revision that decision was saved at: a row decided
 * again, even to the same decision by way of another, has a later one (0 for a row saved before this was kept).
 * `authors` holds names, for the screen and the confirm's words; `deciders` holds the members' ids, which tell people
 * apart: a row that waited is judged by whose decision is stored, and a name is not unique.
 */
export const StoredDecisions = S.Struct({
  decisions: SavedDecisions,
  authors: S.Record(S.String, S.String),
  deciders: S.Record(S.String, S.String),
  savedAt: S.Record(S.String, S.Finite),
  lastSavedBy: S.Record(S.String, S.String).annotateKey({
    description:
      "Who last saved each row (member id), even when that save changed nothing. A row stored before this was kept has no entry; never the sender by default."
  }),
  lastSavedOn: S.Record(S.String, S.Finite).annotateKey({
    description:
      "The draft revision each row's last save was made on, before that save moved it: a later screen is from after it."
  }),
  saves: S.Int.pipe(
    S.annotateKey({ description: "How many saves have named a row; none for an import that is not stored." }),
    S.withDecodingDefaultKey(Effect.succeed(0)),
    S.withConstructorDefault(Effect.succeed(0))
  )
}).annotate({ description: "The saved draft, its authors and save revisions." })
/** The decoded saved decisions of a draft. */
export type StoredDecisions = typeof StoredDecisions.Type

/** Nothing stored: a draft with no decision, read by nobody. */
export const noStoredDecisions: StoredDecisions = StoredDecisions.make({
  decisions: {},
  authors: {},
  deciders: {},
  savedAt: {},
  lastSavedBy: {},
  lastSavedOn: {}
})

/**
 * What a save whose rows waited was compared at: the draft's revision and how many saves had named a row of it. Its
 * write lands only while both are still so: a save between that changed nothing moved no revision, and may still be
 * somebody's decision of a row that waited.
 */
export type ComparedAt = { readonly revision: number; readonly saves: number }

/**
 * What saving the column choices did: saved them, found them already so (nothing written), found the import closed,
 * or found it changing under every one of its `draftTries` tries (`busy`: nothing written).
 */
export const ChoicesSaved = LiteralKit(["saved", "same", "closed", "busy"]).annotate({
  identifier: "ChoicesSaved",
  description: "What saving the column choices did: saved, already so, the import closed, or always changing"
})
/** The decoded value of `ChoicesSaved`. */
export type ChoicesSaved = typeof ChoicesSaved.Type

/**
 * How many times a request worked out against a draft as read is tried before it gives up with nothing written: a
 * match, in either store; a save, checked against the draft's column choices, what its judgement read, and when it has
 * rows that waited the draft's revision; and a confirm, checked against what its judgement read. Each try that is
 * overtaken (somebody saved or matched in between, or an item, a created row or a suggestion the judgement read changed)
 * reads the draft again; a request overtaken
 * this many times running is answered as busy (`DraftBusy`, saying which kept changing), never retried without end and
 * never a server error.
 */
export const draftTries = 6

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
    readonly beginUpload: {
      (
        actor: Member,
        key: UploadKey,
        counts: { readonly rowCount: number; readonly chunkCount: number }
      ): (self: StagedHead) => Effect.Effect<Result.Result<ImportId, FileProblem>>
      (
        self: StagedHead,
        actor: Member,
        key: UploadKey,
        counts: { readonly rowCount: number; readonly chunkCount: number }
      ): Effect.Effect<Result.Result<ImportId, FileProblem>>
    }
    /** The caller's own unfinished upload with this id. Another member's, or one that finished, is none. */
    readonly findUpload: {
      (actor: Member): (self: string) => Effect.Effect<O.Option<Upload>>
      (self: string, actor: Member): Effect.Effect<O.Option<Upload>>
    }
    /**
     * Stores one piece of an upload. Storing the same piece again stores nothing (the first stays), and a piece for
     * an upload that is gone (cancelled meanwhile) stores nothing either. A piece too large to store is the file's
     * problem, answered as one (`tooLarge`), and nothing is stored.
     */
    readonly putChunk: {
      (
        actor: Member,
        seq: number,
        rows: ReadonlyArray<StagedRow>
      ): (self: Upload) => Effect.Effect<Result.Result<void, FileProblem>>
      (
        self: Upload,
        actor: Member,
        seq: number,
        rows: ReadonlyArray<StagedRow>
      ): Effect.Effect<Result.Result<void, FileProblem>>
    }
    /** Every piece of an upload that has arrived, in order. */
    readonly uploadChunks: {
      (
        actor: Member
      ): (
        self: Upload
      ) => Effect.Effect<ReadonlyArray<{ readonly seq: number; readonly rows: ReadonlyArray<StagedRow> }>>
      (
        self: Upload,
        actor: Member
      ): Effect.Effect<ReadonlyArray<{ readonly seq: number; readonly rows: ReadonlyArray<StagedRow> }>>
    }
    /**
     * Turns an upload into an import with the same id, in one batch: the import, its chunks, the audit line, and the
     * upload deleted. Writes no item. Returns false when the upload was gone, in which case nothing was written.
     */
    readonly finishUpload: {
      (actor: Member, needsAtStart: number): (self: Upload) => Effect.Effect<boolean>
      (self: Upload, actor: Member, needsAtStart: number): Effect.Effect<boolean>
    }
    /** Deletes an unfinished upload and its pieces. Returns false when there was none (finished, or already gone). */
    readonly discardUpload: {
      (actor: Member): (self: string) => Effect.Effect<boolean>
      (self: string, actor: Member): Effect.Effect<boolean>
    }
    /** One import of the organization, without its rows. */
    readonly find: {
      (organizationId: OrganizationId): (self: string) => Effect.Effect<O.Option<Draft>>
      (self: string, organizationId: OrganizationId): Effect.Effect<O.Option<Draft>>
    }
    /**
     * The organization's open imports, newest first, at most `limit` of them, and how many are open in all, so the
     * first screen can say how many it left out.
     */
    readonly listOpen: (
      query: ImportListQuery
    ) => Effect.Effect<{ readonly drafts: ReadonlyArray<Draft>; readonly total: number }>
    /**
     * The organization's imports that were confirmed at least once, last confirmed first, at most `limit`, each
     * with how many items in the system came from it now, and how many such imports there are in all.
     */
    readonly listPast: (
      query: ImportListQuery
    ) => Effect.Effect<{ readonly imports: ReadonlyArray<PastImport>; readonly total: number }>
    /**
     * Removes an import that has no item in force, with everything that hangs off it (its confirms and what they
     * noted, once every one was taken back), and records who removed it, in one atomic batch. Returns false, having
     * written nothing, when the import is gone, is not open, or still has items: those must stay.
     */
    readonly remove: {
      (actor: Member): (self: Draft) => Effect.Effect<boolean>
      (self: Draft, actor: Member): Effect.Effect<boolean>
    }
    /** The saved draft: each row's decision, who made it, and the revision it was saved at. */
    readonly decisions: {
      (organizationId: OrganizationId): (self: string) => Effect.Effect<StoredDecisions>
      (self: string, organizationId: OrganizationId): Effect.Effect<StoredDecisions>
    }
    /**
     * Saves what changed in the draft, row by row, under the member's name, and answers the draft's revision and
     * whether this save moved it. A delta that changes nothing (the same save sent again, or rows somebody else
     * decided the same way) writes nothing, leaves the revision as it is and answers `changed: false`. Nothing is
     * saved when the import is no longer open (`closed`); when its column choices are no longer `draft`'s
     * (`rematched`): each of the delta's decisions that rests on a column (an accept, an undone fix, a Replace or
     * Keep-stored, a keep of one of two) was judged against those choices, and a match since may have made it stale;
     * or when the stored items, created rows or suggestions `read` names are no longer as it read them
     * (`itemsChanged`): a Replace or Keep-stored across a re-match was judged against them. `expected` is what the rows
     * that waited were compared at, when the save has any: nothing is saved, and no revision answered, once the draft is
     * at another revision or another save has named a row since (`moved`), an empty delta included. Every row the save
     * names records who saved it and the revision the save was made on, changed or not. Every check is part of the save's own write, so no match,
     * no save and no item change can fall between the judgement and the write. A save that read nothing passes
     * `noItemsRead`, and one that holds to no revision passes `O.none()` as `expected`.
     */
    readonly decide: {
      (
        actor: Member,
        delta: DecisionDelta,
        read: ItemsAsRead,
        expected: O.Option<ComparedAt>
      ): (self: Draft) => Effect.Effect<Decided>
      (
        self: Draft,
        actor: Member,
        delta: DecisionDelta,
        read: ItemsAsRead,
        expected: O.Option<ComparedAt>
      ): Effect.Effect<Decided>
    }
    /** The columns people chose for fields, as stored with the draft. */
    readonly choices: (draft: Draft) => Effect.Effect<ReadonlyArray<MappingChoice>>
    /** Every field that began to read another column at a match, oldest first, as stored with the draft. */
    readonly moves: (draft: Draft) => Effect.Effect<ReadonlyArray<ColumnMove>>
    /**
     * What the matches of the open import took back from the stored decisions, oldest first, as stored with the draft:
     * empty once it is confirmed.
     */
    readonly takenBack: (draft: Draft) => Effect.Effect<ReadonlyArray<MatchTakeBack>>
    /**
     * Points one field at a file column (or at none, `column` null), in one atomic write with five parts: the choice,
     * stamped with the revision this write moves the draft to when the field reads another column by it (a decision
     * made on an earlier one was made before the field read this column; a pick of the column it already reads keeps
     * the stamp it had, moves nothing and takes nothing back); a move for every field that reads another column after
     * the match, the field itself or one moved off its column (`movesOfMatch`), stamped the same; every stored decision
     * the match takes back (`withoutStaleDecisions`, as if
     * each was made on the revision before the match), whoever made it: accepts and undone fixes of a moved field,
     * and when the SKU moved every Replace, Keep-stored and keep-one-of-two, and the Replaces and Keep-storeds whose
     * comparison `compare` says the match changed; what it took back, kept with the draft by field and kind
     * (`takenBackOfMatch`); and the audit line, which counts what it took back by kind. It is worked out from the
     * draft, its decisions and what `compare` read (stored items, created rows, suggestions) as they are when it writes,
     * not as `draft` read them: a save, a match or a change to what `compare` read that lands first makes it be worked
     * out again, at most `draftTries` times
     * (`busy`, nothing written). The same choice again writes nothing (`same`); an import no longer open writes
     * nothing (`closed`).
     */
    readonly matchColumn: {
      (
        actor: Member,
        choice: { readonly field: Field; readonly column: O.Option<number> },
        detail: string,
        compare: CompareAtMatch
      ): (self: Draft) => Effect.Effect<ChoicesSaved>
      (
        self: Draft,
        actor: Member,
        choice: { readonly field: Field; readonly column: O.Option<number> },
        detail: string,
        compare: CompareAtMatch
      ): Effect.Effect<ChoicesSaved>
    }
    /**
     * The items of the file an earlier confirm of this import created and still has, by row and part (0 when the
     * row is one item).
     */
    readonly createdRows: {
      (
        organizationId: OrganizationId
      ): (self: string) => Effect.Effect<ReadonlyArray<{ readonly rowNumber: number; readonly part: number }>>
      (
        self: string,
        organizationId: OrganizationId
      ): Effect.Effect<ReadonlyArray<{ readonly rowNumber: number; readonly part: number }>>
    }
    /**
     * Opens a confirmed or taken-back import again for its rows to be decided. Items it created and still has are
     * untouched. Opening one that is open already writes nothing.
     */
    readonly reopen: {
      (actor: Member): (self: Draft) => Effect.Effect<void>
      (self: Draft, actor: Member): Effect.Effect<void>
    }
    /** Every changed value the organization's imports wrote, newest import first. */
    readonly changes: (organizationId: OrganizationId) => Effect.Effect<ReadonlyArray<ChangeRecord>>
    /** The staged file, rows included, exactly as it was sent. */
    readonly table: {
      (organizationId: OrganizationId): (self: Draft) => Effect.Effect<StagedTable>
      (self: Draft, organizationId: OrganizationId): Effect.Effect<StagedTable>
    }
    /** The organization's items under these SKU keys. Never another organization's items. */
    readonly storedAmong: {
      (organizationId: OrganizationId): (self: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<StoredItem>>
      (self: ReadonlyArray<string>, organizationId: OrganizationId): Effect.Effect<ReadonlyArray<StoredItem>>
    }
    /**
     * What the form-only rules changed in the rows this import wrote, counted from the changed values its confirms
     * stored: how many rows, and how many values.
     */
    readonly fixed: {
      (
        organizationId: OrganizationId
      ): (self: string) => Effect.Effect<{ readonly rows: number; readonly cells: number }>
      (self: string, organizationId: OrganizationId): Effect.Effect<{ readonly rows: number; readonly cells: number }>
    }
    /**
     * Writes a confirm: the confirming person's unsaved decisions, the close of the import (one revision on, with what
     * its matches took back let go: there is nothing left to name), its new items, the stored items it replaces (each with a kept copy), every row's outcome, the changed values and the
     * audit line, in one atomic batch, and only while the draft is open at `expected` and the stored items, created
     * rows and suggestions `read` names are as the confirm's judgement read them. `closed` when the import was no longer open, `moved` when its
     * draft is at another revision, `itemsChanged` when one of those items changed (the confirm is judged again): in
     * each nothing was written.
     */
    readonly commit: (write: ConfirmWrite) => Effect.Effect<Confirmed>
    /**
     * Takes back the confirms named that are still in force, in one atomic batch: removes their items nobody has
     * changed since, puts back the stored items they replaced that nobody has changed since, keeps the ones someone
     * changed, marks the rows of the removed and restored items, records who took them back with the counts, and
     * writes the audit line. `nothingInForce`, having written nothing, when none of them is in force any more.
     */
    readonly takeBack: (write: TakeBackWrite) => Effect.Effect<TookBack>
    /** Every confirm and take-back of the import, oldest first, with the numbers they stored. */
    readonly history: {
      (organizationId: OrganizationId): (self: string) => Effect.Effect<ReadonlyArray<ImportEvent>>
      (self: string, organizationId: OrganizationId): Effect.Effect<ReadonlyArray<ImportEvent>>
    }
    /** What taking the import back would do now, read from the items and confirms as stored. */
    readonly takeBackState: {
      (organizationId: OrganizationId): (self: string) => Effect.Effect<TakeBackState>
      (self: string, organizationId: OrganizationId): Effect.Effect<TakeBackState>
    }
    /** What the confirms did with each row of the file, by row. */
    readonly outcomes: {
      (organizationId: OrganizationId): (self: string) => Effect.Effect<ReadonlyArray<RowOutcome>>
      (self: string, organizationId: OrganizationId): Effect.Effect<ReadonlyArray<RowOutcome>>
    }
    /** Every item of the organization, by SKU. */
    readonly items: (organizationId: OrganizationId) => Effect.Effect<ReadonlyArray<StoredItem>>
  }
>()("@inventory/catalog-model/Import/ImportStore.store/ImportStore") {
}
