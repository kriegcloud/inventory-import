// The trial blocks of the module-taxonomy exploration (decision 9c) in their decided homes, listed in `CatalogTrial`:
// that the model built from them is well defined, a story for each read and reaction kind, the draft store's paging,
// and the two guarded reads through an Api as each organization reaches them, all in memory.
import * as Domain from "@alchemy.run/domain"
import { Story } from "@alchemy.run/domain/Story"
import { expect, it, layer } from "@effect/vitest"
import { assertNone, assertSome } from "@effect/vitest/utils"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import { Actor, CurrentActor } from "./model/Actor/Actor.context.ts"
import { Session } from "./model/Actor/Session.middleware.ts"
import { DraftStore, DraftRow } from "./model/Draft/DraftStore.port.ts"
import { DraftStoreMemory } from "./model/Draft/DraftStore.memory.ts"
import { ImportActs, RowActed } from "./model/Draft/ImportActs.stream.ts"
import { ImportReview } from "./model/Draft/ImportReview.query.ts"
import * as StageImport from "./model/Import/commands/StageImport.command.ts"
import * as RecordSuggestion from "./model/Import/commands/RecordSuggestion.command.ts"
import * as ColumnMatched from "./model/Import/events/ColumnMatched.event.ts"
import * as ImportConfirmed from "./model/Import/events/ImportConfirmed.event.ts"
import * as ImportStaged from "./model/Import/events/ImportStaged.event.ts"
import * as ImportTakenBack from "./model/Import/events/ImportTakenBack.event.ts"
import * as SuggestionRecorded from "./model/Import/events/SuggestionRecorded.event.ts"
import { ForgetMember } from "./model/Import/ForgetMember.rewrite.ts"
import { Import } from "./model/Import/Import.aggregate.ts"
import { ImportStatus } from "./model/Import/ImportStatus.view.ts"
import { ImportKey, RowKey, UNDO_LABEL } from "./model/Review/Change.schema.ts"
import { noLevel } from "./model/Row/Level.schema.ts"
import { Row } from "./model/Row/Row.aggregate.ts"
import * as RowDecided from "./model/Row/RowDecided.event.ts"
import * as StepUndone from "./model/Row/StepUndone.event.ts"
import { SuggesterUnavailable } from "./model/Suggestion/SuggesterUnavailable.rejection.ts"
import { Suggester } from "./model/Suggestion/Suggester.external.ts"
import { PassKey, SuggestionPass } from "./model/Suggestion/SuggestionPass.saga.ts"
import { CatalogTrial, CatalogTrialHandlers } from "./model/Trial.model.ts"

const handlers = CatalogTrialHandlers.pipe(Layer.provide(DraftStoreMemory))

const story = Story.make(CatalogTrial, { layer: handlers, stub: [Suggester] })

const id = ImportKey.make("imp-1")
const ana = Actor.make({ organizationId: "org_prairie", memberId: "ana", role: "editor" })
const omar = Actor.make({ organizationId: "org_harbor", memberId: "omar", role: "editor" })
const staged = ImportStaged.Event.make({ organizationId: "org_prairie", rows: 3, columns: "sku=A", by: "ana" })

const decided = (change: number, by: string, label: string) =>
  RowDecided.Event.make({
    importId: id,
    organizationId: "org_prairie",
    change,
    by,
    step: `s-${change}`,
    flags: "{}",
    madeOn: 0,
    label
  })

const r1 = `${id}/r-1`

const AnySuggestion = Suggester.toLayer(Effect.succeed({ suggest: () => Effect.succeed({ patch: "" }) }))

it.effect("the model with the trial blocks is well defined", () =>
  Layer.build(
    CatalogTrial.layer(handlers.pipe(Layer.provide(AnySuggestion))).pipe(Layer.provide(Domain.InMemory))
  ).pipe(Effect.scoped)
)

it.effect("an import that is staged reads as open, of its organization, at change 0, in its status view", () =>
  story(
    Story.provide(CurrentActor, ana),
    Story.when(StageImport.Command.make({ importId: id, rows: 3, columns: "sku=A" })),
    Story.then(Import.ref(id), staged),
    Story.view(ImportStatus, Import.ref(id), {
      status: "Open",
      organizationId: O.some("org_prairie"),
      changes: 0
    })
  )
)

it.effect("the status view takes each change's number and follows a confirm and a take-back", () =>
  story(
    Story.given(
      Import.ref(id),
      staged,
      ColumnMatched.Event.make({ change: 1, matching: 1, columns: "sku=B", by: "ana" }),
      ImportConfirmed.Event.make({ change: 2, created: 3, updated: 0, already: 0, notImported: 0, by: "ana" })
    ),
    Story.view(ImportStatus, Import.ref(id), { status: "Imported", changes: 2 }),
    Story.given(
      Import.ref(id),
      ImportTakenBack.Event.make({ change: 3, removed: 3, kept: 0, restored: 0, keptReplaced: 0, by: "ana" })
    ),
    Story.view(ImportStatus, Import.ref(id), { status: "TakenBack", changes: 3 })
  )
)

it.effect("each ask for a suggestion starts its own pass, keyed by the ask, that asks the suggester for a patch", () =>
  story(
    Story.given(Import.ref(id), staged),
    Story.provide(CurrentActor, ana),
    Story.when(RecordSuggestion.Command.make({ importId: id })),
    Story.then(Import.ref(id), SuggestionRecorded.Event.make({ by: "ana" })),
    Story.call("first", Suggester.suggest, { importId: id }),
    Story.when(RecordSuggestion.Command.make({ importId: id })),
    Story.then(Import.ref(id), SuggestionRecorded.Event.make({ by: "ana" })),
    Story.call("second", Suggester.suggest, { importId: id }),
    Story.succeed("first", Suggester.suggest, { patch: "keep=all" }),
    Story.succeed("second", Suggester.suggest, { patch: "keep=none" }),
    Story.saga(SuggestionPass, PassKey.make(`${id}:2`), { _tag: "Completed", result: undefined }),
    Story.saga(SuggestionPass, PassKey.make(`${id}:3`), { _tag: "Completed", result: undefined })
  )
)

it.effect("a pass the suggester refuses ends rejected with the suggester's refusal", () =>
  story(
    Story.given(Import.ref(id), staged),
    Story.provide(CurrentActor, ana),
    Story.when(RecordSuggestion.Command.make({ importId: id })),
    Story.then(Import.ref(id), SuggestionRecorded.Event.make({ by: "ana" })),
    Story.call(Suggester.suggest, { importId: id }),
    Story.fail(Suggester.suggest, SuggesterUnavailable.make({ kind: "TooSlow" })),
    Story.saga(SuggestionPass, PassKey.make(`${id}:2`), {
      _tag: "Rejected",
      rejection: SuggesterUnavailable.make({ kind: "TooSlow" })
    })
  )
)

it.effect("a decided row is read back by its organization, appended once to the acts, and another reads none", () =>
  story(
    Story.given(Import.ref(id), staged),
    Story.given(Row.ref(r1), decided(1, "ana", "Keep")),
    Story.streamed(
      ImportActs,
      id,
      RowActed.make({ row: r1, organizationId: "org_prairie", change: 1, label: "Keep", by: "ana" })
    ),
    Story.streamed(ImportActs, id),
    Story.provide(CurrentActor, ana),
    Story.query(ImportReview, { importId: id }, [{ id: r1, change: 1, label: "Keep", by: "ana" }]),
    Story.provide(CurrentActor, omar),
    Story.query(ImportReview, { importId: id }, []),
    Story.query(ImportReview, { importId: ImportKey.make("imp-2") }, [])
  )
)

it.effect("a row decided twice is read back once, with the later decision, and both acts are appended", () =>
  story(
    Story.given(Import.ref(id), staged),
    Story.given(Row.ref(r1), decided(1, "ana", "Keep"), decided(2, "dana", "Leave out")),
    Story.streamed(
      ImportActs,
      id,
      RowActed.make({ row: r1, organizationId: "org_prairie", change: 1, label: "Keep", by: "ana" }),
      RowActed.make({ row: r1, organizationId: "org_prairie", change: 2, label: "Leave out", by: "dana" })
    ),
    Story.streamed(ImportActs, id),
    Story.provide(CurrentActor, ana),
    Story.query(ImportReview, { importId: id }, [{ id: r1, change: 2, label: "Leave out", by: "dana" }])
  )
)

it.effect("an undo reads back the decision it puts back, an undo of the only decision removes the row", () =>
  story(
    Story.given(Import.ref(id), staged),
    Story.given(
      Row.ref(r1),
      decided(1, "ana", "Keep"),
      decided(2, "dana", "Leave out"),
      StepUndone.Event.make({ next: noLevel, below: "", undo: 2, step: "s-3", by: "dana" })
    ),
    Story.streamed(
      ImportActs,
      id,
      RowActed.make({ row: r1, organizationId: "org_prairie", change: 1, label: "Keep", by: "ana" }),
      RowActed.make({ row: r1, organizationId: "org_prairie", change: 2, label: "Leave out", by: "dana" }),
      RowActed.make({ row: r1, organizationId: "org_prairie", change: 2, label: UNDO_LABEL, by: "dana" })
    ),
    Story.provide(CurrentActor, ana),
    Story.query(ImportReview, { importId: id }, [{ id: r1, change: 1, label: "Keep", by: "ana" }]),
    Story.given(Row.ref(r1), StepUndone.Event.make({ next: noLevel, below: "", undo: 1, step: "s-4", by: "ana" })),
    Story.streamed(
      ImportActs,
      id,
      RowActed.make({ row: r1, organizationId: "org_prairie", change: 1, label: UNDO_LABEL, by: "ana" })
    ),
    Story.streamed(ImportActs, id),
    Story.query(ImportReview, { importId: id }, [])
  )
)

it.effect("the review pages 2 rows by default and 3 at most, with the last id as the cursor while more follow", () =>
  story(
    Story.given(Import.ref(id), staged),
    ...A.map(["r-1", "r-2", "r-3", "r-4"], (row, index) =>
      Story.given(Row.ref(`${id}/${row}`), decided(index + 1, "ana", "Keep"))
    ),
    Story.provide(CurrentActor, ana),
    Story.query(ImportReview, { importId: id }, (page) => {
      expect(A.map(page.entries, (row) => row.id)).toEqual([`${id}/r-1`, `${id}/r-2`])
      expect(page.cursor).toBe(`${id}/r-2`)
    }),
    Story.query(
      ImportReview,
      { importId: id },
      (page) => {
        expect(A.map(page.entries, (row) => row.id)).toEqual([`${id}/r-1`, `${id}/r-2`, `${id}/r-3`])
        expect(page.cursor).toBe(`${id}/r-3`)
      },
      { take: 10 }
    ),
    Story.query(
      ImportReview,
      { importId: id },
      (page) => {
        expect(A.map(page.entries, (row) => row.id)).toEqual([`${id}/r-3`, `${id}/r-4`])
        expect(page.cursor).toBe(null)
      },
      { after: `${id}/r-2` }
    )
  )
)

it.effect("forgetting a member blanks only their asks, and the status view folds the rewritten events", () =>
  story(
    Story.given(
      Import.ref(id),
      staged,
      SuggestionRecorded.Event.make({ by: "ana" }),
      SuggestionRecorded.Event.make({ by: "dana" })
    ),
    Story.view(ImportStatus, Import.ref(id), (status) => assertSome(status.askedBy, "dana")),
    Story.rewrite(Import.ref(id), ForgetMember.make({ memberId: "ana" })),
    Story.view(ImportStatus, Import.ref(id), (status) => assertSome(status.askedBy, "dana")),
    Story.rewrite(Import.ref(id), ForgetMember.make({ memberId: "dana" })),
    Story.view(ImportStatus, Import.ref(id), (status) => assertNone(status.askedBy)),
    Story.state(Import.ref(id), { suggestions: 2 })
  )
)

const row = (rowId: string, importId: ImportKey, organizationId: string) =>
  DraftRow.make({ id: rowId, organizationId, importId, change: 1, label: "Keep", by: "ana" })

layer(DraftStoreMemory)("the draft store in memory", (it) => {
  it.effect("a row recorded again under its id is held once, with the later record", () =>
    Effect.gen(function* () {
      const store = yield* DraftStore
      const importId = ImportKey.make("imp-again")
      yield* store.record([row(`${importId}/r-1`, importId, "org_prairie")])
      yield* store.record([DraftRow.make({ ...row(`${importId}/r-1`, importId, "org_prairie"), change: 2 })])
      const page = yield* store.forImport("org_prairie", importId, { after: undefined, take: 50 })
      expect(A.map(page.entries, (entry) => entry.change)).toEqual([2])
      expect(page.cursor).toBe(null)
    })
  )

  it.effect("a page holds one organization's import after the cursor, by id, and a removed row is gone", () =>
    Effect.gen(function* () {
      const store = yield* DraftStore
      const importId = ImportKey.make("imp-paged")
      const other = ImportKey.make("imp-other")
      yield* store.record([
        row(`${importId}/r-3`, importId, "org_prairie"),
        row(`${importId}/r-1`, importId, "org_prairie"),
        row(`${importId}/r-2`, importId, "org_prairie"),
        row(`${other}/r-1`, other, "org_prairie")
      ])
      const first = yield* store.forImport("org_prairie", importId, { after: undefined, take: 2 })
      expect(A.map(first.entries, (entry) => entry.id)).toEqual([`${importId}/r-1`, `${importId}/r-2`])
      expect(first.cursor).toBe(`${importId}/r-2`)
      const second = yield* store.forImport("org_prairie", importId, { after: `${importId}/r-2`, take: 2 })
      expect(A.map(second.entries, (entry) => entry.id)).toEqual([`${importId}/r-3`])
      expect(second.cursor).toBe(null)
      const elsewhere = yield* store.forImport("org_harbor", importId, { after: undefined, take: 2 })
      expect(elsewhere.entries).toEqual([])
      yield* store.remove([`${importId}/r-1`])
      const after = yield* store.forImport("org_prairie", importId, { after: undefined, take: 2 })
      expect(A.map(after.entries, (entry) => entry.id)).toEqual([`${importId}/r-2`, `${importId}/r-3`])
    })
  )
})

class TrialApi extends Domain.Api("TrialApi", {
  model: CatalogTrial,
  commands: ["StageImport", "DecideRow"],
  views: ["ImportStatus", "RowHolds"],
  streams: ["ImportActs"]
}) {}

const actingAs = (actor: Actor) =>
  Effect.provideService(Session, (effect) => Effect.provideService(effect, CurrentActor, actor))

const Hosted = CatalogTrial.layer(handlers.pipe(Layer.provide(AnySuggestion))).pipe(Layer.provide(Domain.InMemory))

layer(Hosted, { excludeTestServices: true })("the guarded reads, through an Api", (it) => {
  it.effect("the import's organization reads its status, acts and row; another's read of each is refused NotPermitted", () =>
    Effect.gen(function* () {
      const asAna = yield* TrialApi.clientInProcess.pipe(actingAs(ana))
      const asOmar = yield* TrialApi.clientInProcess.pipe(actingAs(omar))
      yield* asAna.StageImport({ importId: id, rows: 3, columns: "sku=A" })
      const decidedRow = yield* asAna.DecideRow({
        importId: id,
        row: RowKey.make("r-1"),
        step: "s-1",
        sawGroup: 0,
        covered: false,
        asItReads: false,
        opening: 0,
        saw: 0,
        sawUndone: 0,
        flags: '{"kept":true}',
        madeOn: 0,
        label: "Keep"
      })
      const status = yield* asAna.ImportStatus.get(id, { atLeast: decidedRow })
      expect(status).toMatchObject({ status: "Open", organizationId: O.some("org_prairie"), changes: 1 })
      const acts = yield* asAna.ImportActs.peek(id, { atLeast: decidedRow })
      expect(acts).toMatchObject({ event: { row: r1, organizationId: "org_prairie", change: 1, by: "ana" } })
      const held = yield* asAna.RowHolds.get(r1, { atLeast: decidedRow })
      expect(held).toMatchObject({ status: "Decided", organizationId: "org_prairie", by: "ana" })
      const refusals = yield* Effect.all(
        [
          Effect.flip(asOmar.ImportStatus.get(id)),
          Effect.flip(asOmar.ImportActs.peek(id)),
          Effect.flip(asOmar.RowHolds.get(r1))
        ],
        { concurrency: 1 }
      )
      expect(A.map(refusals, (refusal) => refusal._tag)).toEqual(["NotPermitted", "NotPermitted", "NotPermitted"])
    }).pipe(Effect.scoped)
  )

  it.effect("an import nobody staged reads as nothing to every organization, so its id is told from one in use", () =>
    Effect.gen(function* () {
      const asAna = yield* TrialApi.clientInProcess.pipe(actingAs(ana))
      const asOmar = yield* TrialApi.clientInProcess.pipe(actingAs(omar))
      const none = ImportKey.make("imp-none")
      const seen = yield* Effect.all(
        [
          asAna.ImportStatus.get(none),
          asAna.ImportActs.peek(none),
          asOmar.ImportStatus.get(none),
          asOmar.ImportActs.peek(none)
        ],
        { concurrency: 1 }
      )
      expect(seen).toEqual([null, null, null, null])
    }).pipe(Effect.scoped)
  )
})
