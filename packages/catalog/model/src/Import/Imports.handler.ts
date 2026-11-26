// The import and item endpoints. The one thing a reader must not break: the browser never sends a row to write. `commit`
// reads the staged file back from storage and runs the same pure `review` the screen ran, so a row the screen
// refused cannot be written by a crafted request.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as HashSet from "effect/HashSet"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Ref from "effect/Ref"
import * as Result from "effect/Result"
import {
  ChoicesSaved,
  Confirmed,
  ConfirmWrite,
  Decided,
  ImportStore,
  Draft,
  DraftStatus,
  draftTries,
  noStoredDecisions,
  type StoredDecisions,
  TakeBackWrite
} from "./ImportStore.store.ts"
import { SuggestionStore } from "../Suggestion/SuggestionStore.store.ts"
import { suggest } from "../Suggestion/Suggestions.handler.ts"
import { confirmPlan, plannedItems, PlannedRow } from "../Confirm/Confirm.rules.ts"
import { Answerer } from "../Answer/Answerer.external.ts"
import { ModelAllowance } from "../Answer/ModelAllowance.external.ts"
import { Activity } from "@inventory/kernel/Activity"
import { ActivityId } from "@inventory/kernel/Ids"
import { ConfirmId as ConfirmIdSchema, ItemId } from "@inventory/catalog-contract/Ids"
import * as SecureRandom from "effect/crypto/SecureRandom"
import * as DateTime from "effect/DateTime"
import { ItemsOfRow } from "../Review/ItemsOfRow.context.ts"
import { Member } from "@inventory/kernel/Member"
import {
  StagedTable,
  type StagedHead,
  StagedHeadJson,
  Field,
  fieldLabels,
  fields
} from "@inventory/catalog-contract/Staged"
import { type ColumnMove, MappingChoice } from "@inventory/catalog-contract/Mapping"
import {
  SavedDecisions,
  rowId,
  DecisionDelta,
  ConfirmRequest,
  RowDecision,
  SaveRequest,
  type DecidedSince,
  type StaleAccept
} from "@inventory/catalog-contract/Decision"
import { review, carryDecisions, ruleFixes, firstDecisions, noHistory } from "../Review/Review.rules.ts"
import { fieldsOf } from "@inventory/catalog-contract/Item"
import { skuKey } from "@inventory/catalog-contract/SkuKey"
import { ImportView, type MatchTakeBack, openImportsShown, pastImportsShown } from "@inventory/catalog-contract/Import"
import {
  ImportNotFound,
  UploadNotFound,
  AcceptsTakenBack,
  AlreadyImported,
  DraftBusy,
  DraftMoved,
  ImportKept,
  ColumnNotFound,
  RevisionAhead
} from "@inventory/catalog-contract/ImportRejection"
import { UploadStart, UploadChunk, uploadDiscard } from "@inventory/catalog-contract/Upload"
import { requireRole, CurrentActor } from "@inventory/kernel/Actor"
import { chunkProblem } from "../Staging/Upload.rules.ts"
import { fileProblem } from "@inventory/catalog-contract/FileProblem"
import { ImportId, ConfirmId } from "@inventory/catalog-contract/Ids"
import * as S from "effect/Schema"
import { stagingProblem } from "../Staging/Staging.rules.ts"
import {
  type HeldTries,
  sameDecision,
  heldToTries,
  type CompareAtMatch,
  type ComparisonQuestion,
  comparisonQuestions,
  comparisonsChanged,
  ItemsAsRead,
  noItemsRead,
  withoutStaleDecisions,
  sameColumn
} from "./Rematch.rules.ts"
import { decidedSince, type Over, overOfSave } from "./Waited.rules.ts"

/**
 * What kept changing under a request that gave up busy: its import (a save or a match landed between its read and
 * its write), what its judgement read beside the import (stored items, created rows, suggestions), or both. The words
 * it is refused with say which, so the person knows whether to look at the import or at the items.
 */
type Overtaken = { readonly draft: boolean; readonly items: boolean }

// Fields named in the item's order, joined as a sentence says them: "SKU", "SKU and Unit cost", "SKU, Name and Unit cost".
const fieldsSaid = (named: ReadonlyArray<string>): string => {
  const labels = A.map(
    A.filter(fields, (field) => A.contains(named, field)),
    (field) => fieldLabels[field]
  )
  return O.match(A.last(labels), {
    onNone: () => "A column",
    onSome: (last) => (labels.length === 1 ? last : `${A.join(A.dropRight(labels, 1), ", ")} and ${last}`)
  })
}

/**
 * Why a confirm carrying decisions a re-match took back is refused, in the person's words: which fields were matched
 * again after the rows were decided, and how many rows rest on them.
 *
 * @example takenBackReason([{ rowId: "row-2", field: "unitCost", kind: "stored" }])
 * // "Unit cost was matched again after you decided 1 row that rests on it. Nothing was imported: look at the row it changed, then confirm again."
 */
const takenBackReason = (taken: ReadonlyArray<StaleAccept>): string => {
  const named = A.dedupe(A.map(taken, (entry) => entry.field))
  const rows = A.dedupe(A.map(taken, (entry) => entry.rowId)).length
  const one = named.length === 1
  const counted = rows === 1 ? "1 row that rests" : `${rows} rows that rest`
  return `${fieldsSaid(named)} ${one ? "was" : "were"} matched again after you decided ${counted} on ${one ? "it" : "them"}. Nothing was imported: look at the ${rows === 1 ? "row" : "rows"} ${one ? "it" : "they"} changed, then confirm again.`
}

/**
 * A request's `madeOn` for the rows it sets and the rows that waited (`over`, a cleared one included), and only those: a
 * key that names neither says nothing about any decision, so it is not read (not judged, not counted against the draft's
 * revision). Worked out once per request.
 */
const madeOnRead = (request: {
  readonly madeOn: Readonly<Record<string, number>>
  readonly set: SavedDecisions
  readonly over: Over
}): Readonly<Record<string, number>> =>
  R.filter(request.madeOn, (_revision, rowId) => R.has(request.set, rowId) || R.has(request.over, rowId))

/**
 * The rows of a save that waited over a decision, with what is stored and what the matches took back, which they are
 * judged by. A confirm names none.
 */
type Waited = {
  readonly over: Over
  readonly clear: ReadonlyArray<string>
  readonly stored: StoredDecisions
  readonly takenBack: ReadonlyArray<MatchTakeBack>
}

/** A request that names no row as waiting: a confirm. */
const noneWaited: Waited = { over: {}, clear: [], stored: noStoredDecisions, takenBack: [] }

/** Revision 0: the import as it was staged, before anybody acted on it. */
const stagedRevision = 0

/**
 * The latest revision a request names, of a row's `madeOn` and `also` (a confirm's `revision`, or `stagedRevision`
 * for a save, which names no revision of its own): none may be ahead of the draft's.
 */
const latestNamed = (madeOn: Readonly<Record<string, number>>, also: number): number =>
  R.reduce(madeOn, also, (latest, revision) => Math.max(latest, revision))

/**
 * A draft's stored decisions with one person's unsaved ones laid over them, as the confirm will store them: a row
 * they set is theirs unless it says what is stored already, and a row they cleared has no decision.
 */
const withUnsaved = (
  stored: StoredDecisions,
  unsaved: { readonly delta: DecisionDelta; readonly author: string; readonly authorId: string }
): StoredDecisions => {
  const changed = R.filter(unsaved.delta.set, (decision, id) =>
    O.match(R.get(stored.decisions, id), { onNone: () => true, onSome: (old) => !sameDecision(old, decision) })
  )
  const cleared = (_: unknown, id: string): boolean => !A.contains(unsaved.delta.clear, id)
  return {
    decisions: R.filter({ ...stored.decisions, ...unsaved.delta.set }, cleared),
    authors: R.filter({ ...stored.authors, ...R.map(changed, () => unsaved.author) }, cleared),
    deciders: R.filter({ ...stored.deciders, ...R.map(changed, () => unsaved.authorId) }, cleared),
    savedAt: R.filter(stored.savedAt, cleared),
    lastSavedBy: R.filter({ ...stored.lastSavedBy, ...R.map(unsaved.delta.set, () => unsaved.authorId) }, cleared),
    lastSavedOn: R.filter(stored.lastSavedOn, cleared),
    saves: stored.saves
  }
}

/**
 * What each endpoint of the imports group does: staging, reading and confirming an import. The ports are resolved once,
 * when the group is built; an endpoint then needs only the actor.
 */
export const importsEndpoints = Effect.gen(function* () {
  const imports = yield* ImportStore
  const suggestionStore = yield* SuggestionStore
  // What asking for suggestions needs beyond the stores: resolved once, here, like the stores.
  const asking = yield* Effect.context<SuggestionStore | Answerer | ModelAllowance | SecureRandom.SecureRandom>()
  const random = yield* SecureRandom.SecureRandom
  // How a row becomes items: the screen's own `itemsOfRow`, so both review the same items.
  const itemsOf = yield* ItemsOfRow

  // The audit line of something the actor did to an import, stamped now. Its detail is the store's to fill in, from
  // what the write counted.
  const auditLine = Effect.fnUntraced(function* (actor: Member, action: string) {
    const id = yield* random.uuidV4()
    const createdAt = yield* DateTime.now
    return Activity.make({
      id: ActivityId.make(id),
      organizationId: actor.organizationId,
      actorId: actor.id,
      actorName: actor.name,
      action,
      detail: "",
      agent: O.none(),
      createdAt
    })
  })

  // Which codes of this import the organization already has: the file's own, and any the person typed. Asked
  // with the keys, never by listing every item. `keys` are the keys asked, `found` the items as stored.
  const storedAmongFile = Effect.fn("imports.storedAmongFile")(function* (
    actor: Member,
    table: StagedTable,
    choices: ReadonlyArray<MappingChoice>,
    decisions: ReadonlyArray<RowDecision>
  ) {
    const blank = review({ ...noHistory, table, choices, decisions: {}, storedItems: [], itemsOf })
    const typed = A.getSomes(A.map(decisions, (decision) => R.get(decision.edits, "sku")))
    const keys = A.dedupe(
      A.filter(
        [...A.map(blank.rows, (row) => skuKey({ sku: row.file.sku })), ...A.map(typed, (sku) => skuKey({ sku }))],
        (key) => key !== ""
      )
    )
    const found = yield* imports.storedAmong(actor.organizationId, keys)
    return { keys, found }
  })

  // The stored items the review compares the file's rows with.
  const storedFor = Effect.fn("imports.storedFor")(function* (
    actor: Member,
    table: StagedTable,
    choices: ReadonlyArray<MappingChoice>,
    decisions: SavedDecisions
  ) {
    const { found } = yield* storedAmongFile(actor, table, choices, R.values(decisions))
    return A.map(found, fieldsOf)
  })

  // The file's review, asked whether re-matches changed how rows compare with their stored items: each side as the
  // screen would draw it, with the import's stored items, suggestions and created rows; and all three as it read them,
  // which the write checks are still so. `asked.questions` has a row at most once: a match asks of the stored decisions,
  // a save and a confirm of their own rows (never of what a row that waited names: that is judged from what the matches
  // recorded). `known` saves a read of the staged table when the caller holds it.
  const compared = Effect.fn("imports.compare")(function* (
    actor: Member,
    draft: Draft,
    asked: {
      readonly choices: ReadonlyArray<MappingChoice>
      readonly moves: ReadonlyArray<ColumnMove>
      readonly questions: ReadonlyArray<ComparisonQuestion>
    },
    table: StagedTable
  ) {
    const typed = A.map(asked.questions, (question) => question.then)
    const { keys, found } = yield* storedAmongFile(actor, table, asked.choices, typed)
    const created = yield* imports.createdRows(actor.organizationId, draft.id)
    const suggestions = yield* suggestionStore.list(actor.organizationId, draft.id)
    const changed = comparisonsChanged({
      table,
      choices: asked.choices,
      moves: asked.moves,
      storedItems: A.map(found, fieldsOf),
      createdIds: A.map(created, (row) => rowId({ rowNumber: row.rowNumber, part: O.some(row.part) })),
      suggestions,
      itemsOf,
      questions: asked.questions
    })
    const read = ItemsAsRead.make({
      asked: true,
      keys,
      items: A.map(found, (item) => ({ id: item.id, revision: item.revision })),
      created: A.map(created, (row) => ({ rowNumber: row.rowNumber, part: row.part })),
      suggestions: A.map(suggestions, (suggestion) => suggestion.id)
    })
    return { changed, read }
  })

  // The same, as a match asks it.
  const compareFor =
    (actor: Member, draft: Draft, table: StagedTable): CompareAtMatch =>
    (asked) =>
      compared(actor, draft, asked, table)

  // The file's head as staged: its columns, with no row read.
  const headOf = (draft: Draft) => S.decodeEffect(StagedHeadJson)(draft.headJson).pipe(Effect.orDie)

  // A match's question to the review, held across the store's tries of the one match: an answer a later try gives only
  // because an item, a created row or a suggestion changed in between never adds a take-back (`answeredAcrossTries`).
  // Held while the tries are asked with the same columns, whatever revision each was asked at: a save on another row in
  // between keeps the earlier answers, and another person's match in between starts them afresh (`heldToTries`), so a
  // take-back a column causes is never held down; a row decided again in between is asked afresh. `head` is the file's,
  // which never changes.
  const heldAcrossTries = Effect.fnUntraced(function* (head: StagedHead, compare: CompareAtMatch) {
    const earlier = yield* Ref.make<O.Option<HeldTries>>(O.none())
    const held: CompareAtMatch = Effect.fnUntraced(function* (asked) {
      const answer = yield* compare(asked)
      const kept = heldToTries({
        earlier: yield* Ref.get(earlier),
        head,
        choices: asked.choices,
        moves: asked.moves,
        questions: asked.questions,
        changed: answer.changed
      })
      yield* Ref.set(earlier, O.some(kept.held))
      return { changed: kept.changed, read: answer.read }
    })
    return held
  })

  // Decisions as they may be applied, judged against every column matched again since each row's revision; what was
  // taken back; the rows that waited and were decided otherwise since (`waited`, compared with the decisions stored);
  // and what the judgement read (`read`), which the save's and the confirm's write check are still so. The file's review
  // is read only when a Replace or a Keep-stored of the request's own rows rests on another column than the SKU's that
  // was matched again since; otherwise nothing was read. A row that waited is judged from what the matches recorded
  // they took back (`waited.takenBack`), never by the review, so a save costs the same however many decisions it names. `earlier` is what the earlier tries of the
  // same request answered: an answer is held to them while the columns they were asked with are the same, so an item
  // stocked or edited in between never adds a take-back, and a column matched in between starts them afresh
  // (`heldToTries`); `held` is what the next try is held to.
  const judged = Effect.fn("imports.judged")(function* (
    actor: Member,
    draft: Draft,
    request: { readonly madeOn: Readonly<Record<string, number>>; readonly set: SavedDecisions },
    earlier: O.Option<HeldTries>,
    waited: Waited
  ) {
    const choices = yield* imports.choices(draft)
    const moves = yield* imports.moves(draft)
    const { madeOn, set } = request
    const questions = comparisonQuestions({ choices, moves, madeOn, set })
    const answer = A.isReadonlyArrayNonEmpty(questions)
      ? yield* Effect.flatMap(imports.table(actor.organizationId, draft), (table) =>
          compared(actor, draft, { choices, moves, questions }, table)
        )
      : { changed: [], read: noItemsRead }
    const own = answer.changed
    const tried = A.isReadonlyArrayNonEmpty(questions)
      ? yield* Effect.map(headOf(draft), (head) =>
          O.some(heldToTries({ earlier, head, choices, moves, questions, changed: own }))
        )
      : O.none()
    const tries = O.match(tried, {
      onNone: () => ({ changed: own, held: earlier }),
      onSome: (made) => ({ changed: made.changed, held: O.some(made.held) })
    })
    const { applied, notApplied } = withoutStaleDecisions({ choices, moves, madeOn, set, changed: tries.changed })
    const cleared = HashSet.fromIterable(waited.clear)
    const since = decidedSince({
      choices,
      moves,
      madeOn,
      over: waited.over,
      stored: waited.stored.decisions,
      savedAt: waited.stored.savedAt,
      deciders: waited.stored.deciders,
      lastSavedBy: waited.stored.lastSavedBy,
      lastSavedOn: waited.stored.lastSavedOn,
      sender: actor.id,
      takenBack: waited.takenBack,
      takenBackFrom: draft.takenBackFrom,
      left: (row) => (HashSet.has(cleared, row) ? O.none() : R.get(applied, row))
    })
    return { applied, notApplied, decidedSince: since, read: answer.read, held: tries.held }
  })

  // The one place a review is worked out on the server, so the commit applies decisions exactly as the screen did.
  // The stored draft is normalised first: a lossless fix the person did not take is held back, whatever was saved.
  // `known` is the staged table when the caller already holds it (an upload that just finished), saving a read.
  // `unsaved` is the confirming person's own decisions not saved yet: the review is worked out with them laid over
  // what is stored, under their name, as the confirm will store them.
  const reviewOf = Effect.fn("imports.reviewOf")(function* (
    actor: Member,
    draft: Draft,
    table: StagedTable,
    unsaved: O.Option<DecisionDelta>
  ) {
    const choices = yield* imports.choices(draft)
    const held = yield* imports.decisions(actor.organizationId, draft.id)
    const stored = O.match(unsaved, {
      onNone: () => held,
      onSome: (delta) => withUnsaved(held, { delta, author: actor.name, authorId: actor.id })
    })
    const storedItems = yield* storedFor(actor, table, choices, stored.decisions)
    const created = yield* imports.createdRows(actor.organizationId, draft.id)
    const createdIds = A.map(created, (row) => rowId({ rowNumber: row.rowNumber, part: O.some(row.part) }))
    // The rows behind them, as the view has always said them: one number per row, however many items it holds.
    const createdRows = A.dedupe(A.map(created, (item) => item.rowNumber))
    const decisions = carryDecisions({ table, choices, decisions: stored.decisions, mode: ruleFixes, itemsOf })
    // The stored suggestions: the review turns each into a proposal that waits, here exactly as on the screen.
    const suggestions = yield* suggestionStore.list(actor.organizationId, draft.id)
    return {
      table,
      suggestions,
      choices,
      storedItems,
      createdRows,
      createdIds,
      decisions,
      // What is stored, before the rules' own fixes are held back: the rows that have a decision of their own.
      saved: stored.decisions,
      authors: stored.authors,
      current: review({ table, choices, decisions, storedItems, createdIds, itemsOf, suggestions })
    }
  })

  const viewOf = (actor: Member, draft: Draft) =>
    Effect.flatMap(imports.table(actor.organizationId, draft), (table) => viewWith(actor, draft, table))

  const viewWith = Effect.fn("imports.viewWith")(function* (actor: Member, draft: Draft, table: StagedTable) {
    const { storedItems, decisions, current, choices, createdRows, createdIds, suggestions } = yield* reviewOf(
      actor,
      draft,
      table,
      O.none()
    )
    const confirmed = !DraftStatus.is.open(draft.status)
    const outcomes = confirmed ? yield* imports.outcomes(actor.organizationId, draft.id) : []
    const tally = (outcome: string): number => A.filter(outcomes, (row) => row.outcome === outcome).length
    const history = yield* imports.history(actor.organizationId, draft.id)
    const takeBack = yield* imports.takeBackState(actor.organizationId, draft.id)
    // What matches took back is named only while the import is open: once confirmed there is nothing left to decide.
    const takenBack = confirmed ? [] : yield* imports.takenBack(draft)
    const fixed = confirmed ? yield* imports.fixed(actor.organizationId, draft.id) : { rows: 0, cells: 0 }
    return ImportView.make({
      id: draft.id,
      fileName: draft.fileName,
      status: draft.status,
      startedBy: draft.actorName,
      createdAt: draft.createdAt,
      rowCount: draft.rowCount,
      storedItems,
      mapping: current.mapping,
      choices,
      unusedColumns: current.unusedColumns,
      createdRows,
      createdIds,
      decisions,
      suggestions,
      revision: draft.revision,
      progress: {
        needsAtStart: draft.needsAtStart,
        needs: current.counts.needs,
        decision: current.counts.decision,
        cannot: current.counts.cannot,
        ready: current.counts.ready,
        fixedRows: current.fixed.rows,
        fixedCells: current.fixed.cells,
        rows: current.counts.rows
      },
      // A confirm stamps who and when in one statement: there is a result once both are stored.
      result:
        O.isSome(draft.importedAt) && O.isSome(draft.importedBy)
          ? O.some({
              importedBy: draft.importedBy.value,
              importedAt: draft.importedAt.value,
              created: tally("created"),
              updated: tally("updated"),
              already: tally("already"),
              notImported: tally("notImported"),
              takenBack: tally("takenBack"),
              fixed,
              rows: outcomes
            })
          : O.none(),
      history,
      takeBack,
      takenBack
    })
  })

  const find = Effect.fn("imports.find")(function* (actor: Member, id: string) {
    const draft = yield* imports.find(actor.organizationId, id)
    if (O.isNone(draft)) {
      return yield* ImportNotFound.make({
        reason: "No import with that id in your organization.",
        organizationId: actor.organizationId
      })
    }
    return draft.value
  })

  // A save judged against the draft's column choices and what its judgement read, and written only while both are
  // still so (the store checks them in the save's own write). A match, or a change to an item, created row or
  // suggestion the judgement read, in between makes the store refuse it: the import is read again and the save judged
  // against what it has now (held to what the earlier tries answered while the columns are the same; after a match,
  // afresh). A row that waited (`over`) is written only while what is stored of it is one of the decisions it names; the
  // rest are answered with what is stored (`decidedSince`), and the other rows are saved. What is stored is read after
  // the draft, and the save is written, and those rows named, only while the draft is still at the revision read: a
  // save, a match or a confirm in between makes it be compared again. A save with no such row has none of that. Each is
  // a person's press, so a few tries settle it; a save overtaken on every one of `draftTries` is answered as busy, in
  // words that say what kept changing, with nothing written. `latest` is the latest revision the request names.
  const saveChecked = Effect.fn("imports.saveChecked")(function* (
    actor: Member,
    id: ImportId,
    payload: Pick<SaveRequest, "madeOn" | "set" | "clear"> & { readonly over: Over },
    latest: number,
    tries: { readonly left: number; readonly overtaken: Overtaken; readonly held: O.Option<HeldTries> }
  ): Effect.fn.Return<
    {
      readonly revision: number
      readonly changed: boolean
      readonly notApplied: ReadonlyArray<StaleAccept>
      readonly decidedSince: ReadonlyArray<DecidedSince>
    },
    AlreadyImported | ImportNotFound | RevisionAhead | DraftBusy
  > {
    const draft = yield* find(actor, id)
    if (latest > draft.revision) return yield* ahead(draft)
    const waiting = !R.isEmptyRecord(payload.over)
    // With who decided each row, who last saved it and the revisions: a row that waited is judged by whose it is.
    const stored: StoredDecisions = waiting
      ? yield* imports.decisions(actor.organizationId, draft.id)
      : noStoredDecisions
    // What the matches recorded they took back, as stored with the draft read: the rows that waited are judged by it.
    const takenBack = waiting ? yield* imports.takenBack(draft) : []
    // A decision made before a column it rests on was matched again is not applied; the rest of the row's decision is.
    const { applied, notApplied, decidedSince, read, held } = yield* judged(actor, draft, payload, tries.held, {
      over: payload.over,
      clear: payload.clear,
      stored,
      takenBack
    })
    // A row decided otherwise since is not written at all: nothing of it was taken back by this save either.
    const notWritten = HashSet.fromIterable(A.map(decidedSince, (row) => row.rowId))
    const done = yield* imports.decide(
      actor,
      draft,
      {
        set: R.filter(applied, (_decision, row) => !HashSet.has(notWritten, row)),
        clear: A.filter(payload.clear, (row) => !HashSet.has(notWritten, row))
      },
      read,
      // Written only while no save has come since what was compared, even one that moved no revision.
      waiting ? O.some({ revision: draft.revision, saves: stored.saves }) : O.none()
    )
    const again = (overtaken: Overtaken) =>
      tries.left <= 1
        ? Effect.fail(busy(overtaken))
        : saveChecked(actor, id, payload, latest, { left: tries.left - 1, overtaken, held })
    return yield* Decided.match(done, {
      saved: (saved) =>
        Effect.succeed({
          revision: saved.revision,
          changed: saved.changed,
          notApplied: A.filter(notApplied, (taken) => !HashSet.has(notWritten, taken.rowId)),
          decidedSince
        }),
      closed: () => Effect.fail(closed(draft)),
      rematched: () => again({ ...tries.overtaken, draft: true }),
      moved: () => again({ ...tries.overtaken, draft: true }),
      itemsChanged: () => again({ ...tries.overtaken, items: true })
    })
  })

  // A confirm judged against the draft at the revision it names and what its judgement read, and written only while
  // both are still so (the store checks them in the confirm's own batch). A draft moved on is the person's to look at
  // (`DraftMoved`); a stored item, created row or suggestion changed under the judgement is not on their screen's
  // draft, so the confirm is judged again against them as they are, held to what the earlier tries answered (a take-back
  // comes only from a column matched again after the decision, never from an item stocked or edited in between), at
  // most `draftTries` times (then busy, in words that say the items kept changing; nothing written). `earlier` is
  // what the earlier tries answered. Answers the draft the confirm closed.
  const confirmChecked = Effect.fn("imports.confirmChecked")(function* (
    actor: Member,
    id: ImportId,
    payload: ConfirmRequest,
    triesLeft: number,
    earlier: O.Option<HeldTries>
  ): Effect.fn.Return<
    Draft,
    AlreadyImported | ImportNotFound | RevisionAhead | DraftMoved | AcceptsTakenBack | DraftBusy
  > {
    const draft = yield* find(actor, id)
    if (!DraftStatus.is.open(draft.status)) return yield* closed(draft)
    // A revision the draft has not reached is not taken on the client's word.
    const madeOn = madeOnRead({ ...payload, over: {} })
    if (latestNamed(madeOn, payload.revision) > draft.revision) return yield* ahead(draft)
    // Somebody has changed the draft since the picture this confirm was made on: nothing is written, and the
    // person is shown the newer picture before they confirm. The store checks the same again inside its write.
    if (draft.revision !== payload.revision) return yield* moved(draft.revision)
    // A decision among the ones it carries, made before a column it rests on was matched again (an accept, an undone
    // fix, a Replace or Keep-stored, a keep-one-of-two), is about what the row no longer reads: confirming would
    // write another thing than the screen shows. Nothing is written.
    const {
      notApplied: stale,
      read,
      held
    } = yield* judged(actor, draft, { madeOn, set: payload.set }, earlier, noneWaited)
    if (A.isReadonlyArrayNonEmpty(stale)) {
      return yield* AcceptsTakenBack.make({ reason: takenBackReason(stale), accepts: stale })
    }
    // Decisions made a moment before the confirm, not saved yet, are the person's own: the review counts them, and
    // the store saves them in the confirm's own write.
    const unsaved: DecisionDelta = { set: payload.set, clear: payload.clear }
    const table = yield* imports.table(actor.organizationId, draft)
    const { current, authors } = yield* reviewOf(actor, draft, table, O.some(unsaved))
    const plan = confirmPlan({ draft: draft.id, review: current, authors, actor })
    // The ids of the confirm and of each item it creates are made here, so the store only writes.
    const confirm = yield* random.uuidV4()
    const itemIds = yield* Effect.forEach(
      A.filter(plannedItems(plan), PlannedRow.guards.ready),
      () => Effect.map(random.uuidV4(), (id) => ItemId.make(id)),
      { concurrency: 1 }
    )
    const audit = yield* auditLine(actor, "Imported items")
    const done = yield* imports.commit(
      ConfirmWrite.make({
        draft: draft.id,
        fileName: draft.fileName,
        confirm: ConfirmIdSchema.make(confirm),
        plan,
        itemIds,
        audit,
        expected: payload.revision,
        unsaved,
        read
      })
    )
    return yield* Confirmed.match(done, {
      confirmed: () => Effect.succeed(draft),
      closed: () => Effect.fail(closed(draft)),
      moved: (now) => Effect.fail(moved(now.revision)),
      // Only what the judgement read beside the import changed: the draft is still the one the screen showed.
      itemsChanged: () =>
        triesLeft <= 1
          ? Effect.fail(busy({ draft: false, items: true }))
          : confirmChecked(actor, id, payload, triesLeft - 1, held)
    })
  })

  const gone = () =>
    UploadNotFound.make({
      reason: "This upload is no longer on the server: it was cancelled or left unfinished. Choose the file again."
    })

  // The caller's own unfinished upload, or the error that says it is gone.
  const findUpload = Effect.fn("imports.findUpload")(function* (actor: Member, id: string) {
    const upload = yield* imports.findUpload(actor, id)
    if (O.isNone(upload)) return yield* gone()
    return upload.value
  })

  const closed = (draft: Draft) =>
    AlreadyImported.make({ reason: `${draft.fileName} was already imported. Nothing was written a second time.` })

  const moved = (revision: number) =>
    DraftMoved.make({
      reason:
        "Someone else changed this import while you were reviewing it. Nothing was imported: look at what changed, then confirm again.",
      revision
    })

  // The words say what kept changing: the import, items it would change (and what else beside the import its
  // judgement read), or both, which is all a match that gave up busy can say. Never who: the same person's other tab
  // moves the import as anyone else does, so the words are true of both.
  const busy = (overtaken: Overtaken) =>
    DraftBusy.make({
      reason: overtaken.items
        ? overtaken.draft
          ? "This import, or items it would change, kept being changed (in another tab, by someone else, by another import or on the Items page) while your request was worked out, so nothing was written. Try again in a moment."
          : "Items this would change kept being changed elsewhere (by another import, on the Items page or by a take-back), or suggestions kept arriving for this import, while your request was worked out, so nothing was written. The import itself did not change. Try again in a moment."
        : "This import kept being changed (in another tab or by someone else) while your request was worked out, so nothing was written. Try again in a moment."
    })

  const ahead = (draft: Draft) =>
    RevisionAhead.make({
      reason:
        "This request names a version of the import the server has not reached. Nothing was saved: read the import again.",
      revision: draft.revision
    })

  const kept = (draft: Draft) =>
    ImportKept.make({
      reason: DraftStatus.is.open(draft.status)
        ? `${draft.fileName} has items in the system, so it stays with them. Nothing was removed.`
        : `${draft.fileName} was confirmed, so it stays with the items and results it wrote. Nothing was removed.`
    })

  return {
    beginUpload: Effect.fn("imports.beginUpload")(function* ({ payload }: { readonly payload: UploadStart }) {
      const actor = yield* requireRole("editor")
      const { key, head, rowCount, chunkCount } = payload
      // A problem with the file is the answer, as data (200): the screen says what is wrong and what to do.
      const problem = stagingProblem({ fileName: head.fileName, rowCount, columnCount: head.columns.length })
      if (O.isSome(problem)) return Result.fail(problem.value)
      // Pieces that cannot carry the rows never reach here: `UploadStart` refuses that start when it is decoded.
      const begun = yield* imports.beginUpload(actor, key, head, { rowCount, chunkCount })
      return Result.map(begun, (id) => ({ id }))
    }),
    putChunk: Effect.fn("imports.putChunk")(function* ({
      params,
      payload
    }: {
      readonly params: { readonly id: ImportId }
      readonly payload: UploadChunk
    }) {
      const actor = yield* requireRole("editor")
      const upload = yield* findUpload(actor, params.id)
      if (payload.seq >= upload.chunkCount) {
        return Result.fail(fileProblem.incomplete({ fileName: upload.fileName, how: "unsent" }))
      }
      const stored = yield* imports.putChunk(actor, upload, payload.seq, payload.rows)
      return Result.map(stored, () => ({ seq: payload.seq, rows: payload.rows.length }))
    }),
    finishUpload: Effect.fn("imports.finishUpload")(function* ({
      params
    }: {
      readonly params: { readonly id: ImportId }
    }) {
      const actor = yield* requireRole("editor")
      // Finished already (a retry whose first answer was lost): the import has the upload's id.
      const finished = yield* imports.find(actor.organizationId, params.id)
      if (O.isSome(finished)) return yield* Effect.map(viewOf(actor, finished.value), Result.succeed)
      const upload = yield* findUpload(actor, params.id)
      const head = yield* S.decodeEffect(StagedHeadJson)(upload.headJson).pipe(Effect.orDie)
      const chunks = yield* imports.uploadChunks(actor, upload)
      const table: StagedTable = { ...head, rows: A.flatMap(chunks, (chunk) => chunk.rows) }
      const problem = O.orElse(
        chunkProblem({
          fileName: upload.fileName,
          rowCount: upload.rowCount,
          chunkCount: upload.chunkCount,
          chunks
        }),
        () => stagingProblem({ fileName: head.fileName, rowCount: table.rows.length, columnCount: head.columns.length })
      )
      if (O.isSome(problem)) return Result.fail(problem.value)
      const start = review({
        table,
        choices: [],
        decisions: firstDecisions({ table, choices: [], mode: ruleFixes, itemsOf }),
        storedItems: [],
        createdIds: [],
        suggestions: [],
        itemsOf
      })
      yield* imports.finishUpload(actor, upload, start.counts.needs)
      // Another request finished it in between (a double send): either way the import now exists, or the upload
      // was cancelled meanwhile and there is nothing.
      const draft = yield* imports.find(actor.organizationId, upload.id)
      if (O.isNone(draft)) return yield* gone()
      return yield* Effect.map(viewWith(actor, draft.value, table), Result.succeed)
    }),
    discardUpload: Effect.fn("imports.discardUpload")(function* ({
      params
    }: {
      readonly params: { readonly id: ImportId }
    }) {
      const actor = yield* requireRole("editor")
      const deleted = yield* imports.discardUpload(actor, params.id)
      return uploadDiscard(deleted)
    }),
    match: Effect.fn("imports.match")(function* ({
      params,
      payload
    }: {
      readonly params: { readonly id: ImportId }
      readonly payload: { readonly field: Field; readonly column: O.Option<number> }
    }) {
      const actor = yield* requireRole("editor")
      const draft = yield* find(actor, params.id)
      if (!DraftStatus.is.open(draft.status)) return yield* closed(draft)
      const table = yield* imports.table(actor.organizationId, draft)
      const asked = payload.column
      const column = O.flatMap(asked, (index) => A.findFirst(table.columns, (candidate) => candidate.index === index))
      if (O.isSome(payload.column) && O.isNone(column)) {
        return yield* ColumnNotFound.make({ reason: `${draft.fileName} has no column at that position.` })
      }
      const before = yield* imports.choices(draft)
      // The same match again (a second press, a retry) is the same match: nothing is taken back, dropped or
      // written to the audit trail a second time.
      if (A.some(before, (choice) => choice.field === payload.field && sameColumn(choice.column, asked))) {
        return yield* viewOf(actor, draft)
      }
      // One write: the choice, stamped with the revision that write moves the draft to when the field reads another
      // column by it (a decision made on an earlier one was made before the match), and a move for every field that
      // reads another column (a pick of the column the field already reads moves nothing and takes nothing back); every
      // stored decision that rests on a column the match moved taken out (the review is asked which Replaces it changed), and
      // kept with the draft by field and kind for every screen to name; and the audit line, with what it took back
      // counted. Nothing can fall between them. The answer is the view, which names what this match took back.
      const label = fieldLabels[payload.field]
      const compare = yield* heldAcrossTries(table, compareFor(actor, draft, table))
      const saved = yield* imports.matchColumn(
        actor,
        draft,
        { field: payload.field, column: asked },
        O.match(column, {
          onNone: () => `${label}: no column, in ${draft.fileName}`,
          onSome: (found) => `${label} reads column ${found.letter} "${found.label}" in ${draft.fileName}`
        }),
        compare
      )
      if (ChoicesSaved.is.closed(saved)) return yield* closed(draft)
      // The store does not say whether the import or what its review read kept changing: the words name both.
      if (ChoicesSaved.is.busy(saved)) return yield* busy({ draft: true, items: true })
      const after = yield* find(actor, draft.id)
      return yield* viewOf(actor, after)
    }),
    get: Effect.fn("imports.get")(function* ({ params }: { readonly params: { readonly id: ImportId } }) {
      const actor = yield* CurrentActor
      const draft = yield* find(actor, params.id)
      return yield* viewOf(actor, draft)
    }),
    table: Effect.fn("imports.table")(function* ({ params }: { readonly params: { readonly id: ImportId } }) {
      const actor = yield* CurrentActor
      const draft = yield* find(actor, params.id)
      return yield* imports.table(actor.organizationId, draft)
    }),
    // Any member may read the list. Each view runs the full review of its file, which is why only the newest
    // `openImportsShown` are sent and the rest are counted.
    open: Effect.fn("imports.open")(function* () {
      const actor = yield* CurrentActor
      const { drafts, total } = yield* imports.listOpen(actor.organizationId, openImportsShown)
      const views = yield* Effect.forEach(drafts, (draft) => viewOf(actor, draft), { concurrency: 1 })
      return { views, older: Math.max(0, total - views.length) }
    }),
    past: Effect.fn("imports.past")(function* () {
      const actor = yield* CurrentActor
      const { imports: listed, total } = yield* imports.listPast(actor.organizationId, pastImportsShown)
      return { imports: listed, older: Math.max(0, total - listed.length) }
    }),
    changes: Effect.fn("imports.changes")(function* () {
      const actor = yield* CurrentActor
      return yield* imports.changes(actor.organizationId)
    }),
    // Asks for suggestions where the rules have none. It stores proposals only: no decision and no item changes,
    // and the review the person sees next shows each one waiting on its row.
    suggest: Effect.fn("imports.suggest")(function* ({ params }: { readonly params: { readonly id: ImportId } }) {
      const actor = yield* requireRole("editor")
      const draft = yield* find(actor, params.id)
      if (!DraftStatus.is.open(draft.status)) return yield* closed(draft)
      const table = yield* imports.table(actor.organizationId, draft)
      const { current, suggestions } = yield* reviewOf(actor, draft, table, O.none())
      const done = yield* suggest({
        importId: draft.id,
        fileName: draft.fileName,
        source: { table, review: current, suggestions }
      }).pipe(Effect.provideContext(asking))
      return {
        made: done.made,
        suggestions: yield* suggestionStore.list(actor.organizationId, draft.id),
        answeredBy: done.answeredBy,
        lines: done.lines
      }
    }),
    decide: Effect.fn("imports.decide")(function* ({
      params,
      payload
    }: {
      readonly params: { readonly id: ImportId }
      readonly payload: SaveRequest
    }) {
      const actor = yield* requireRole("editor")
      const { set, clear } = payload
      const over = overOfSave(payload)
      const madeOn = madeOnRead({ madeOn: payload.madeOn, set, over })
      return yield* saveChecked(actor, params.id, { madeOn, over, set, clear }, latestNamed(madeOn, stagedRevision), {
        left: draftTries,
        overtaken: { draft: false, items: false },
        held: O.none()
      })
    }),
    commit: Effect.fn("imports.commit")(function* ({
      params,
      payload
    }: {
      readonly params: { readonly id: ImportId }
      readonly payload: ConfirmRequest
    }) {
      const actor = yield* requireRole("editor")
      const draft = yield* confirmChecked(actor, params.id, payload, draftTries, O.none())
      const after = yield* find(actor, draft.id)
      return yield* viewOf(actor, after)
    }),
    // Takes back the confirms the person was shown, if they are still in force. A second press finds them taken back
    // already and writes nothing; either way the answer is the import as it now is, counted from what is stored.
    takeBack: Effect.fn("imports.takeBack")(function* ({
      params,
      payload
    }: {
      readonly params: { readonly id: ImportId }
      readonly payload: { readonly confirms: ReadonlyArray<ConfirmId> }
    }) {
      const actor = yield* requireRole("editor")
      const draft = yield* find(actor, params.id)
      const takeBack = yield* random.uuidV4()
      const audit = yield* auditLine(actor, "Took back an import")
      yield* imports.takeBack(
        TakeBackWrite.make({ draft: draft.id, fileName: draft.fileName, takeBack, confirms: payload.confirms, audit })
      )
      const after = yield* find(actor, draft.id)
      return yield* viewOf(actor, after)
    }),
    reopen: Effect.fn("imports.reopen")(function* ({ params }: { readonly params: { readonly id: ImportId } }) {
      const actor = yield* requireRole("editor")
      const draft = yield* find(actor, params.id)
      if (!DraftStatus.is.open(draft.status)) yield* imports.reopen(actor, draft)
      const after = yield* find(actor, draft.id)
      return yield* viewOf(actor, after)
    }),
    remove: Effect.fn("imports.remove")(function* ({ params }: { readonly params: { readonly id: ImportId } }) {
      const actor = yield* requireRole("editor")
      const draft = yield* find(actor, params.id)
      if (!DraftStatus.is.open(draft.status)) return yield* kept(draft)
      // An open import that still has items (reopened, or taken back with one kept) is refused by the batch,
      // as is one a confirm closed after the read above.
      if (yield* imports.remove(actor, draft)) return
      // Nothing was removed. Either another request removed it first (a double click), which answers as a second
      // remove does, or it has created items and stays.
      yield* find(actor, draft.id)
      return yield* kept(draft)
    })
  }
})
