// The import and item endpoints. The one thing a reader must not break: the browser never sends a row to write. `commit`
// reads the staged file back from storage and runs the same pure `review` the screen ran, so a row the screen
// refused cannot be written by a crafted request.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Result from "effect/Result"
import {
  ConfirmWrite,
  ImportStore,
  Draft,
  draftTries,
  type StoredDecisions,
  TakeBackWrite
} from "./ImportStore.store.ts"
import { SuggestionStore } from "../Suggestion/SuggestionStore.store.ts"
import { suggest } from "../Suggestion/Suggestions.handler.ts"
import { confirmPlan, plannedItems } from "../Confirm/Confirm.rules.ts"
import { Answerer } from "../Answer/Answerer.external.ts"
import { ModelAllowance } from "../Answer/ModelAllowance.external.ts"
import { Activity } from "@inventory/kernel/Activity"
import { ActivityId } from "@inventory/kernel/Ids"
import { ConfirmId as ConfirmIdSchema, ItemId } from "@inventory/catalog-contract/Ids"
import * as SecureRandom from "effect/crypto/SecureRandom"
import * as DateTime from "effect/DateTime"
import { ItemsOfRow } from "../Review/ItemsOfRow.context.ts"
import { Member } from "@inventory/kernel/Member"
import { StagedTable, StagedHead, Field, fieldLabels } from "@inventory/catalog-contract/Staged"
import { MappingChoice } from "@inventory/catalog-contract/Mapping"
import {
  SavedDecisions,
  rowId,
  DecisionDelta,
  ConfirmRequest,
  RowDecision,
  SaveRequest,
  type StaleAccept
} from "@inventory/catalog-contract/Decision"
import { review, carryDecisions, ruleFixes, firstDecisions } from "../Review/Review.rules.ts"
import { skuKey, fieldsOf } from "@inventory/catalog-contract/Item"
import { ImportView, openImportsShown, pastImportsShown } from "@inventory/catalog-contract/Import"
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
import { fitsChunks, chunkProblem } from "../Staging/Upload.rules.ts"
import { fileProblem } from "@inventory/catalog-contract/FileProblem"
import { ImportId, ConfirmId } from "@inventory/catalog-contract/Ids"
import * as S from "effect/Schema"
import { stagingProblem } from "../Staging/Staging.rules.ts"
import {
  type CompareAtMatch,
  comparisonQuestions,
  comparisonsChanged,
  noItemsRead,
  withoutStaleDecisions
} from "./Rematch.rules.ts"

/**
 * A request's `madeOn` for the rows it sets, and only those: a key that names no row of `set` says nothing about any
 * decision, so it is not read (not judged, not counted against the draft's revision). Worked out once per request.
 */
const madeOnOfSet = (request: {
  readonly madeOn: Readonly<Record<string, number>>
  readonly set: SavedDecisions
}): Readonly<Record<string, number>> => R.filter(request.madeOn, (_revision, rowId) => R.has(request.set, rowId))

/** The latest revision a request names, of a row's `madeOn` and a confirm's `revision`: none ahead of `draft`'s. */
const latestNamed = (madeOn: Readonly<Record<string, number>>, also: number = 0): number =>
  R.reduce(madeOn, also, (latest, revision) => Math.max(latest, revision))

/**
 * A draft's stored decisions with one person's unsaved ones laid over them, as the confirm will store them: a row
 * they set is theirs unless it says what is stored already, and a row they cleared has no decision.
 */
const withUnsaved = (
  stored: StoredDecisions,
  unsaved: { readonly delta: DecisionDelta; readonly author: string }
): StoredDecisions => {
  const same = S.toEquivalence(RowDecision)
  const changed = R.filter(unsaved.delta.set, (decision, id) =>
    O.match(R.get(stored.decisions, id), { onNone: () => true, onSome: (old) => !same(old, decision) })
  )
  const cleared = (_: unknown, id: string): boolean => !A.contains(unsaved.delta.clear, id)
  return {
    decisions: R.filter({ ...stored.decisions, ...unsaved.delta.set }, cleared),
    authors: R.filter({ ...stored.authors, ...R.map(changed, () => unsaved.author) }, cleared)
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
    decisions: SavedDecisions
  ) {
    const blank = review({ table, choices, decisions: {}, storedItems: [], itemsOf })
    const typed = A.getSomes(A.map(R.values(decisions), (decision) => R.get(decision.edits, "sku")))
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
    const { found } = yield* storedAmongFile(actor, table, choices, decisions)
    return A.map(found, fieldsOf)
  })

  // The file's review, asked whether re-matches changed how rows compare with their stored items: each side as the
  // screen would draw it, with the import's stored items, suggestions and created rows; and the stored items it read,
  // which a match's write checks are still as read. `known` saves a read of the staged table when the caller holds it.
  const compareFor =
    (actor: Member, draft: Draft, known?: StagedTable): CompareAtMatch =>
    (asked) =>
      Effect.gen(function* () {
        const table = known ?? (yield* imports.table(actor.organizationId, draft))
        const typed = R.fromEntries(A.map(asked.questions, (question) => [question.rowId, question.then] as const))
        const { keys, found } = yield* storedAmongFile(actor, table, asked.choices, typed)
        const created = yield* imports.createdRows(actor.organizationId, draft.id)
        const suggestions = yield* suggestionStore.list(actor.organizationId, draft.id)
        const changed = comparisonsChanged({
          table,
          choices: asked.choices,
          moves: asked.moves,
          storedItems: A.map(found, fieldsOf),
          createdIds: A.map(created, rowId),
          suggestions,
          itemsOf,
          questions: asked.questions
        })
        return { changed, read: { keys, items: A.map(found, (item) => ({ id: item.id, revision: item.revision })) } }
      }).pipe(Effect.withSpan("imports.compare"))

  // Decisions as they may be applied, judged against every column matched again since each row's revision; what was
  // taken back; and the stored items the judgement read (`read`), which the save's and the confirm's write check are
  // still as read. The file's review is read only when a Replace or a Keep-stored rests on another column than the
  // SKU's that was matched again since; otherwise no item was read.
  const judged = Effect.fn("imports.judged")(function* (
    actor: Member,
    draft: Draft,
    request: { readonly madeOn: Readonly<Record<string, number>>; readonly set: SavedDecisions }
  ) {
    const choices = yield* imports.choices(draft)
    const moves = yield* imports.moves(draft)
    const questions = comparisonQuestions({ choices, moves, madeOn: request.madeOn, set: request.set })
    const compared = A.isReadonlyArrayNonEmpty(questions)
      ? yield* compareFor(actor, draft)({ choices, moves, questions })
      : { changed: [], read: noItemsRead }
    return {
      ...withoutStaleDecisions({ choices, moves, madeOn: request.madeOn, set: request.set, changed: compared.changed }),
      read: compared.read
    }
  })

  // The one place a review is worked out on the server, so the commit applies decisions exactly as the screen did.
  // The stored draft is normalised first: a lossless fix the person did not take is held back, whatever was saved.
  // `known` is the staged table when the caller already holds it (an upload that just finished), saving a read.
  // `unsaved` is the confirming person's own decisions not saved yet: the review is worked out with them laid over
  // what is stored, under their name, as the confirm will store them.
  const reviewOf = Effect.fn("imports.reviewOf")(function* (
    actor: Member,
    draft: Draft,
    known?: StagedTable,
    unsaved?: DecisionDelta
  ) {
    const table = known ?? (yield* imports.table(actor.organizationId, draft))
    const choices = yield* imports.choices(draft)
    const held = yield* imports.decisions(actor.organizationId, draft.id)
    const stored = unsaved === undefined ? held : withUnsaved(held, { delta: unsaved, author: actor.name })
    const storedItems = yield* storedFor(actor, table, choices, stored.decisions)
    const created = yield* imports.createdRows(actor.organizationId, draft.id)
    const createdIds = A.map(created, rowId)
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

  const viewOf = Effect.fn("imports.viewOf")(function* (actor: Member, draft: Draft, known?: StagedTable) {
    const { storedItems, decisions, current, choices, createdRows, createdIds, suggestions } = yield* reviewOf(
      actor,
      draft,
      known
    )
    const confirmed = draft.status !== "open"
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
      return yield* ImportNotFound.make({ reason: "No import with that id in your organization." })
    }
    return draft.value
  })

  // A save judged against the draft's column choices and the stored items as read, and written only while both are
  // still so (the store checks them in the save's own write). A match or an item change in between makes the store
  // refuse it: the import is read again and the save judged against what it has now. Each is a person's press, so a
  // few tries settle it; a save overtaken on every one of `draftTries` is answered as busy, with nothing written.
  // `latest` is the latest revision the request names, worked out once.
  const saveChecked = Effect.fn("imports.saveChecked")(function* (
    actor: Member,
    id: ImportId,
    payload: SaveRequest,
    latest: number,
    triesLeft: number
  ): Effect.fn.Return<
    { readonly revision: number; readonly changed: boolean; readonly notApplied: ReadonlyArray<StaleAccept> },
    AlreadyImported | ImportNotFound | RevisionAhead | DraftBusy
  > {
    const draft = yield* find(actor, id)
    if (latest > draft.revision) return yield* ahead(draft)
    // A decision made before a column it rests on was matched again is not applied; the rest of the row's decision is.
    const { applied, notApplied, read } = yield* judged(actor, draft, payload)
    const done = yield* imports.decide(actor, draft, { set: applied, clear: payload.clear }, read)
    if (done.kind === "saved") return { revision: done.revision, changed: done.changed, notApplied }
    if (done.kind === "closed") return yield* closed(draft)
    if (triesLeft <= 1) return yield* busy()
    return yield* saveChecked(actor, id, payload, latest, triesLeft - 1)
  })

  // A confirm judged against the draft at the revision it names and the stored items as read, and written only while
  // both are still so (the store checks them in the confirm's own batch). A draft moved on is the person's to look at
  // (`DraftMoved`); a stored item changed under the judgement is not on their screen's draft, so the confirm is judged
  // again against the items as they are, at most `draftTries` times (then busy, nothing written). Answers the draft
  // the confirm closed.
  const confirmChecked = Effect.fn("imports.confirmChecked")(function* (
    actor: Member,
    id: ImportId,
    payload: ConfirmRequest,
    triesLeft: number
  ): Effect.fn.Return<
    Draft,
    AlreadyImported | ImportNotFound | RevisionAhead | DraftMoved | AcceptsTakenBack | DraftBusy
  > {
    const draft = yield* find(actor, id)
    if (draft.status !== "open") return yield* closed(draft)
    // A revision the draft has not reached is not taken on the client's word.
    const madeOn = madeOnOfSet(payload)
    if (latestNamed(madeOn, payload.revision) > draft.revision) return yield* ahead(draft)
    // Somebody has changed the draft since the picture this confirm was made on: nothing is written, and the
    // person is shown the newer picture before they confirm. The store checks the same again inside its write.
    if (draft.revision !== payload.revision) return yield* moved(draft.revision)
    // A decision among the ones it carries, made before a column it rests on was matched again (an accept, an undone
    // fix, a Replace or Keep-stored, a keep-one-of-two), is about what the row no longer reads: confirming would
    // write another thing than the screen shows. Nothing is written.
    const { notApplied: stale, read } = yield* judged(actor, draft, { madeOn, set: payload.set })
    if (A.isReadonlyArrayNonEmpty(stale)) {
      return yield* AcceptsTakenBack.make({
        reason:
          "A column was matched again after you decided rows that rest on it. Nothing was imported: look at the rows it changed, then confirm again.",
        accepts: stale
      })
    }
    // Decisions made a moment before the confirm, not saved yet, are the person's own: the review counts them, and
    // the store saves them in the confirm's own write.
    const unsaved: DecisionDelta = { set: payload.set, clear: payload.clear }
    const { current, authors } = yield* reviewOf(actor, draft, undefined, unsaved)
    const plan = confirmPlan({ draft: draft.id, review: current, authors, actor })
    // The ids of the confirm and of each item it creates are made here, so the store only writes.
    const confirm = yield* random.uuidV4()
    const itemIds = yield* Effect.forEach(
      A.filter(plannedItems(plan), (row) => row.status === "ready"),
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
    if (done.kind === "closed") return yield* closed(draft)
    if (done.kind === "moved") return yield* moved(done.revision)
    if (done.kind === "confirmed") return draft
    if (triesLeft <= 1) return yield* busy()
    return yield* confirmChecked(actor, id, payload, triesLeft - 1)
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

  const busy = () =>
    DraftBusy.make({
      reason:
        "Others kept changing this import while your request was worked out, so nothing was written. Try again in a moment."
    })

  const ahead = (draft: Draft) =>
    RevisionAhead.make({
      reason:
        "This request names a version of the import the server has not reached. Nothing was saved: read the import again.",
      revision: draft.revision
    })

  const kept = (draft: Draft) =>
    ImportKept.make({
      reason:
        draft.status === "open"
          ? `${draft.fileName} has items in the system, so it stays with them. Nothing was removed.`
          : `${draft.fileName} was confirmed, so it stays with the items and results it wrote. Nothing was removed.`
    })

  return {
    beginUpload: Effect.fn("imports.beginUpload")(function* ({ payload }: { readonly payload: UploadStart }) {
      const actor = yield* requireRole("editor")
      const { key, head, rowCount, chunkCount } = payload
      // A problem with the file is the answer, as data (200): the screen says what is wrong and what to do.
      const problem = stagingProblem({ fileName: head.fileName, rowCount, columnCount: head.columns.length })
      if (problem !== null) return Result.fail(problem)
      if (!fitsChunks({ rowCount, chunkCount })) {
        return Result.fail(fileProblem.incomplete({ fileName: head.fileName, how: "unsent" }))
      }
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
      const head = yield* S.decodeEffect(S.fromJsonString(StagedHead))(upload.headJson).pipe(Effect.orDie)
      const chunks = yield* imports.uploadChunks(actor, upload)
      const table: StagedTable = { ...head, rows: A.flatMap(chunks, (chunk) => chunk.rows) }
      const problem =
        chunkProblem({
          fileName: upload.fileName,
          rowCount: upload.rowCount,
          chunkCount: upload.chunkCount,
          chunks
        }) ?? stagingProblem({ fileName: head.fileName, rowCount: table.rows.length, columnCount: head.columns.length })
      if (problem !== null) return Result.fail(problem)
      const start = review({
        table,
        choices: [],
        decisions: firstDecisions({ table, choices: [], mode: ruleFixes, itemsOf }),
        storedItems: [],
        itemsOf
      })
      yield* imports.finishUpload(actor, upload, start.counts.needs)
      // Another request finished it in between (a double send): either way the import now exists, or the upload
      // was cancelled meanwhile and there is nothing.
      const draft = yield* imports.find(actor.organizationId, upload.id)
      if (O.isNone(draft)) return yield* gone()
      return yield* Effect.map(viewOf(actor, draft.value, table), Result.succeed)
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
      if (draft.status !== "open") return yield* closed(draft)
      const table = yield* imports.table(actor.organizationId, draft)
      const asked = O.getOrNull(payload.column)
      const column = A.findFirst(table.columns, (candidate) => candidate.index === asked)
      if (O.isSome(payload.column) && O.isNone(column)) {
        return yield* ColumnNotFound.make({ reason: `${draft.fileName} has no column at that position.` })
      }
      const before = yield* imports.choices(draft)
      // The same match again (a second press, a retry) is the same match: nothing is taken back, dropped or
      // written to the audit trail a second time.
      if (A.some(before, (choice) => choice.field === payload.field && choice.column === asked)) {
        return yield* viewOf(actor, draft)
      }
      // One write: the choice, stamped with the revision that write moves the draft to (a decision made on an earlier
      // one was made before the match), and a move for it and for every field it moved off its column; every stored
      // decision that rests on a column the match moved taken out (the review is asked which Replaces it changed), and
      // kept with the draft by field and kind for every screen to name; and the audit line, with what it took back
      // counted. Nothing can fall between them. The answer is the view, which names what this match took back.
      const label = fieldLabels[payload.field]
      const saved = yield* imports.matchColumn(
        actor,
        draft,
        { field: payload.field, column: asked },
        O.match(column, {
          onNone: () => `${label}: no column, in ${draft.fileName}`,
          onSome: (found) => `${label} reads column ${found.letter} "${found.label}" in ${draft.fileName}`
        }),
        compareFor(actor, draft, table)
      )
      if (saved === "closed") return yield* closed(draft)
      if (saved === "busy") return yield* busy()
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
      if (draft.status !== "open") return yield* closed(draft)
      const { table, current, suggestions } = yield* reviewOf(actor, draft)
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
      const madeOn = madeOnOfSet(payload)
      return yield* saveChecked(actor, params.id, { ...payload, madeOn }, latestNamed(madeOn), draftTries)
    }),
    commit: Effect.fn("imports.commit")(function* ({
      params,
      payload
    }: {
      readonly params: { readonly id: ImportId }
      readonly payload: ConfirmRequest
    }) {
      const actor = yield* requireRole("editor")
      const draft = yield* confirmChecked(actor, params.id, payload, draftTries)
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
      if (draft.status !== "open") yield* imports.reopen(actor, draft)
      const after = yield* find(actor, draft.id)
      return yield* viewOf(actor, after)
    }),
    remove: Effect.fn("imports.remove")(function* ({ params }: { readonly params: { readonly id: ImportId } }) {
      const actor = yield* requireRole("editor")
      const draft = yield* find(actor, params.id)
      if (draft.status !== "open") return yield* kept(draft)
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
