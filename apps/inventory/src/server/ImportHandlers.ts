// The import and item endpoints. The one thing a reader must not break: the browser never sends a row to write. `commit`
// reads the staged file back from storage and runs the same pure `review` the screen ran, so a row the screen
// refused cannot be written by a crafted request.
import { Array as Arr, Effect, Option, Record as Rec, Result } from "effect"
import * as S from "effect/Schema"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../api/v1/Api.ts"
import { ItemChanged, ItemNotFound } from "@inventory/catalog-contract/Catalog"
import { ImportView, openImportsShown, pastImportsShown } from "@inventory/catalog-contract/Import"
import {
  AlreadyImported,
  ColumnNotFound,
  ImportKept,
  ImportNotFound,
  UploadNotFound
} from "@inventory/catalog-contract/ImportRejection"
import { uploadDiscard } from "@inventory/catalog-contract/Upload"
import { CurrentActor } from "@inventory/kernel/Actor"
import { fileProblem } from "@inventory/catalog-contract/FileProblem"
import type { Member } from "@inventory/kernel/Member"
import { fieldsOf, skuKey } from "@inventory/catalog-contract/Item"
import {
  carryDecisions,
  dropAccepted,
  firstDecisions,
  type Proposal,
  review,
  ruleFixes,
  stagingProblem
} from "../domain/ItemImport.ts"
import { changeDecidedBy } from "@inventory/catalog-contract/Change"
import { rowId, type SavedDecisions } from "@inventory/catalog-contract/Decision"
import { type MappingChoice } from "@inventory/catalog-contract/Mapping"
import { fieldLabels, StagedHead, type StagedTable } from "@inventory/catalog-contract/Staged"
import { chunkProblem, fitsChunks } from "../domain/Upload.ts"
import { requireRole } from "@inventory/kernel/Actor"
import { ItemsOfRow } from "./ImportShape.ts"
import { type CommitRow, type Draft, Imports } from "./Imports.ts"
import { Items } from "./Items.ts"
import { Suggestions } from "./Suggestions.ts"

/** Handlers for staging, reading and confirming an import. */
export const ImportHandlers = HttpApiBuilder.group(
  Api,
  "imports",
  Effect.fn(function* (handlers) {
    const imports = yield* Imports
    const suggester = yield* Suggestions
    // How a row becomes items: the screen's own `itemsOfRow`, so both review the same items.
    const itemsOf = yield* ItemsOfRow

    // Which codes of this import the organization already has: the file's own, and any the person typed. Asked
    // with the keys, never by listing every item.
    const storedFor = Effect.fn("imports.storedFor")(function* (
      actor: Member,
      table: StagedTable,
      choices: ReadonlyArray<MappingChoice>,
      decisions: SavedDecisions
    ) {
      const blank = review({ table, choices, decisions: {}, storedItems: [], itemsOf })
      const typed = Arr.getSomes(Arr.map(Rec.values(decisions), (decision) => Rec.get(decision.edits, "sku")))
      const keys = Arr.dedupe(
        Arr.filter(
          [...Arr.map(blank.rows, (row) => skuKey({ sku: row.file.sku })), ...Arr.map(typed, (sku) => skuKey({ sku }))],
          (key) => key !== ""
        )
      )
      const found = yield* imports.storedAmong(actor.organizationId, keys)
      return Arr.map(found, fieldsOf)
    })

    // The one place a review is worked out on the server, so the commit applies decisions exactly as the screen did.
    // The stored draft is normalised first: a lossless fix the person did not take is held back, whatever was saved.
    // `known` is the staged table when the caller already holds it (an upload that just finished), saving a read.
    const reviewOf = Effect.fn("imports.reviewOf")(function* (actor: Member, draft: Draft, known?: StagedTable) {
      const table = known ?? (yield* imports.table(actor.organizationId, draft))
      const choices = yield* imports.choices(draft)
      const stored = yield* imports.decisions(actor.organizationId, draft.id)
      const storedItems = yield* storedFor(actor, table, choices, stored.decisions)
      const created = yield* imports.createdRows(actor.organizationId, draft.id)
      const createdIds = Arr.map(created, rowId)
      // The rows behind them, as the view has always said them: one number per row, however many items it holds.
      const createdRows = Arr.dedupe(Arr.map(created, (item) => item.rowNumber))
      const decisions = carryDecisions({ table, choices, decisions: stored.decisions, mode: ruleFixes, itemsOf })
      // The stored suggestions: the review turns each into a proposal that waits, here exactly as on the screen.
      const suggestions = yield* suggester.list(actor.organizationId, draft.id)
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
      const tally = (outcome: string): number => Arr.filter(outcomes, (row) => row.outcome === outcome).length
      const history = yield* imports.history(actor.organizationId, draft.id)
      const takeBack = yield* imports.takeBackState(actor.organizationId, draft.id)
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
          Option.isSome(draft.importedAt) && Option.isSome(draft.importedBy)
            ? Option.some({
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
            : Option.none(),
        history,
        takeBack
      })
    })

    const find = Effect.fn("imports.find")(function* (actor: Member, id: string) {
      const draft = yield* imports.find(actor.organizationId, id)
      if (Option.isNone(draft)) {
        return yield* ImportNotFound.make({ reason: "No import with that id in your organization." })
      }
      return draft.value
    })

    // An accept is stored by field. When the proposal behind a field can change, the accept is taken back, so a
    // different value never arrives as something the person agreed to.
    const dropAccepts = Effect.fn("imports.dropAccepts")(function* (
      actor: Member,
      draft: Draft,
      drop: (proposal: Proposal) => boolean
    ) {
      const { current, saved } = yield* reviewOf(actor, draft)
      yield* imports.rewriteDecisions(actor, draft, dropAccepted({ decisions: saved, rows: current.rows, drop }))
    })

    const gone = () =>
      UploadNotFound.make({
        reason: "This upload is no longer on the server: it was cancelled or left unfinished. Choose the file again."
      })

    // The caller's own unfinished upload, or the error that says it is gone.
    const findUpload = Effect.fn("imports.findUpload")(function* (actor: Member, id: string) {
      const upload = yield* imports.findUpload(actor, id)
      if (Option.isNone(upload)) return yield* gone()
      return upload.value
    })

    const closed = (draft: Draft) =>
      AlreadyImported.make({ reason: `${draft.fileName} was already imported. Nothing was written a second time.` })

    const kept = (draft: Draft) =>
      ImportKept.make({
        reason:
          draft.status === "open"
            ? `${draft.fileName} has items in the system, so it stays with them. Nothing was removed.`
            : `${draft.fileName} was confirmed, so it stays with the items and results it wrote. Nothing was removed.`
      })

    return handlers.handleAll({
      beginUpload: Effect.fn("imports.beginUpload")(function* ({ payload }) {
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
      putChunk: Effect.fn("imports.putChunk")(function* ({ params, payload }) {
        const actor = yield* requireRole("editor")
        const upload = yield* findUpload(actor, params.id)
        if (payload.seq >= upload.chunkCount) {
          return Result.fail(fileProblem.incomplete({ fileName: upload.fileName, how: "unsent" }))
        }
        const stored = yield* imports.putChunk(actor, upload, payload.seq, payload.rows)
        return Result.map(stored, () => ({ seq: payload.seq, rows: payload.rows.length }))
      }),
      finishUpload: Effect.fn("imports.finishUpload")(function* ({ params }) {
        const actor = yield* requireRole("editor")
        // Finished already (a retry whose first answer was lost): the import has the upload's id.
        const finished = yield* imports.find(actor.organizationId, params.id)
        if (Option.isSome(finished)) return yield* Effect.map(viewOf(actor, finished.value), Result.succeed)
        const upload = yield* findUpload(actor, params.id)
        const head = yield* S.decodeEffect(S.fromJsonString(StagedHead))(upload.headJson).pipe(Effect.orDie)
        const chunks = yield* imports.uploadChunks(actor, upload)
        const table: StagedTable = { ...head, rows: Arr.flatMap(chunks, (chunk) => chunk.rows) }
        const problem =
          chunkProblem({
            fileName: upload.fileName,
            rowCount: upload.rowCount,
            chunkCount: upload.chunkCount,
            chunks
          }) ??
          stagingProblem({ fileName: head.fileName, rowCount: table.rows.length, columnCount: head.columns.length })
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
        if (Option.isNone(draft)) return yield* gone()
        return yield* Effect.map(viewOf(actor, draft.value, table), Result.succeed)
      }),
      discardUpload: Effect.fn("imports.discardUpload")(function* ({ params }) {
        const actor = yield* requireRole("editor")
        const deleted = yield* imports.discardUpload(actor, params.id)
        return uploadDiscard(deleted)
      }),
      match: Effect.fn("imports.match")(function* ({ params, payload }) {
        const actor = yield* requireRole("editor")
        const draft = yield* find(actor, params.id)
        if (draft.status !== "open") return yield* closed(draft)
        const table = yield* imports.table(actor.organizationId, draft)
        const asked = Option.getOrNull(payload.column)
        const column = Arr.findFirst(table.columns, (candidate) => candidate.index === asked)
        if (Option.isSome(payload.column) && Option.isNone(column)) {
          return yield* ColumnNotFound.make({ reason: `${draft.fileName} has no column at that position.` })
        }
        const before = yield* imports.choices(draft)
        // The same match again (a second press, a retry) is the same match: nothing is taken back, dropped or
        // written to the audit trail a second time.
        if (Arr.some(before, (choice) => choice.field === payload.field && choice.column === asked)) {
          return yield* viewOf(actor, draft)
        }
        const next: ReadonlyArray<MappingChoice> = [
          ...Arr.filter(before, (choice) => choice.field !== payload.field),
          { field: payload.field, column: asked, by: "person" }
        ]
        // This field will read another column: an accept of a proposal about it goes.
        yield* dropAccepts(actor, draft, (proposal) => proposal.field === payload.field)
        const label = fieldLabels[payload.field]
        const saved = yield* imports.setChoices(
          actor,
          draft,
          next,
          Option.match(column, {
            onNone: () => `${label}: no column, in ${draft.fileName}`,
            onSome: (found) => `${label} reads column ${found.letter} "${found.label}" in ${draft.fileName}`
          })
        )
        if (saved === "closed") return yield* closed(draft)
        const after = yield* find(actor, draft.id)
        return yield* viewOf(actor, after)
      }),
      get: Effect.fn("imports.get")(function* ({ params }) {
        const actor = yield* CurrentActor
        const draft = yield* find(actor, params.id)
        return yield* viewOf(actor, draft)
      }),
      table: Effect.fn("imports.table")(function* ({ params }) {
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
      suggest: Effect.fn("imports.suggest")(function* ({ params }) {
        const actor = yield* requireRole("editor")
        const draft = yield* find(actor, params.id)
        if (draft.status !== "open") return yield* closed(draft)
        const { table, current, suggestions } = yield* reviewOf(actor, draft)
        const done = yield* suggester.suggest(actor, {
          importId: draft.id,
          fileName: draft.fileName,
          source: { table, review: current, suggestions }
        })
        return {
          made: done.made,
          suggestions: yield* suggester.list(actor.organizationId, draft.id),
          answeredBy: done.answeredBy,
          lines: done.lines
        }
      }),
      decide: Effect.fn("imports.decide")(function* ({ params, payload }) {
        const actor = yield* requireRole("editor")
        const draft = yield* find(actor, params.id)
        const revision = yield* imports.decide(actor, draft, payload)
        if (Option.isNone(revision)) return yield* closed(draft)
        return { revision: revision.value }
      }),
      commit: Effect.fn("imports.commit")(function* ({ params, payload }) {
        const actor = yield* requireRole("editor")
        const draft = yield* find(actor, params.id)
        if (draft.status !== "open") return yield* closed(draft)
        // Decisions made a moment before the confirm, not saved yet, are saved first.
        if (Rec.keys(payload.set).length > 0 || payload.clear.length > 0) {
          const saved = yield* imports.decide(actor, draft, payload)
          if (Option.isNone(saved)) return yield* closed(draft)
        }
        const { current, authors } = yield* reviewOf(actor, draft)
        const who = (row: { readonly id: string }): string =>
          Option.getOrElse(Rec.get(authors, row.id), () => actor.name)
        const rows = Arr.map(current.rows, (row): CommitRow => ({
          rowNumber: row.rowNumber,
          part: row.part ?? 0,
          sku: row.values.sku,
          name: row.values.name,
          status:
            row.status === "ready"
              ? row.update
                ? "update"
                : "ready"
              : row.status === "already"
                ? "already"
                : "notImported",
          // Every problem of the row, so the not-imported rows and their download name each one.
          reason: Arr.join(row.reasons, " "),
          decidedBy: row.status === "out" ? "person" : row.status === "needs" ? "nobody" : null,
          decidedByName: row.status === "out" ? who(row) : null,
          item: row.item,
          changes:
            row.item === null
              ? []
              : Arr.map(row.changes, (change) => ({
                  change,
                  decidedByName: changeDecidedBy(change) === "person" ? who(row) : null
                }))
        }))
        const won = yield* imports.commit(actor, draft, rows)
        if (!won) return yield* closed(draft)
        const after = yield* find(actor, draft.id)
        return yield* viewOf(actor, after)
      }),
      // Takes back the confirms the person was shown, if they are still in force. A second press finds them taken back
      // already and writes nothing; either way the answer is the import as it now is, counted from what is stored.
      takeBack: Effect.fn("imports.takeBack")(function* ({ params, payload }) {
        const actor = yield* requireRole("editor")
        const draft = yield* find(actor, params.id)
        yield* imports.takeBack(actor, draft, payload.confirms)
        const after = yield* find(actor, draft.id)
        return yield* viewOf(actor, after)
      }),
      reopen: Effect.fn("imports.reopen")(function* ({ params }) {
        const actor = yield* requireRole("editor")
        const draft = yield* find(actor, params.id)
        if (draft.status !== "open") yield* imports.reopen(actor, draft)
        const after = yield* find(actor, draft.id)
        return yield* viewOf(actor, after)
      }),
      remove: Effect.fn("imports.remove")(function* ({ params }) {
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
    })
  })
)

/**
 * Handlers for the items an organization has. Any member may read them, and only their own organization's: the
 * organization is always the actor's, never one named in the request.
 */
export const ItemHandlers = HttpApiBuilder.group(
  Api,
  "items",
  Effect.fn(function* (handlers) {
    const imports = yield* Imports
    const items = yield* Items
    return handlers.handleAll({
      list: Effect.fn("items.list")(function* () {
        const actor = yield* CurrentActor
        return yield* imports.items(actor.organizationId)
      }),
      page: Effect.fn("items.page")(function* ({ query }) {
        const actor = yield* CurrentActor
        return yield* items.page(actor.organizationId, {
          page: query.page,
          perPage: query.perPage,
          sorting: query.sort,
          filters: query.filters,
          joinOperator: query.joinOperator,
          search: query.search
        })
      }),
      facets: Effect.fn("items.facets")(function* () {
        const actor = yield* CurrentActor
        return yield* items.facets(actor.organizationId)
      }),
      // A person's change to one item. The same edit sent twice answers the item and writes nothing the second time.
      edit: Effect.fn("items.edit")(function* ({ params, payload }) {
        const actor = yield* requireRole("editor")
        const done = yield* items.edit(actor, params.id, payload)
        switch (done._tag) {
          case "Edited":
          case "Same":
            return done.item
          case "Changed":
            return yield* ItemChanged.make({
              reason: `Someone changed ${done.item.sku} while you were editing it. Here is the item as it is now: make your change again.`,
              item: done.item
            })
          case "Missing":
            return yield* ItemNotFound.make({
              reason: "This item is not in your organization any more: the import that created it was taken back."
            })
        }
      })
    })
  })
)
