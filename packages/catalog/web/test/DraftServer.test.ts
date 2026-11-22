// The review's draft against the server's own handler, over the in-memory twins: a save of hers partly written (a part
// not applied, or one a match took back since) whose answer was lost goes again over what this tab sent, and the server
// finds it as hers, in either order and after a reload. Where the server still cannot tell (a decision sent before a
// match, named by a save made after it), the line says what is saved and never that somebody else decided it.
import { describe, expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as SecureRandom from "effect/crypto/SecureRandom"
import { decisionFromFlags, type SavedDecisions } from "@inventory/catalog-contract/Decision"
import { ImportEvent, type ImportView } from "@inventory/catalog-contract/Import"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import { UploadKey } from "@inventory/catalog-contract/Ids"
import type { Field, StagedTable } from "@inventory/catalog-contract/Staged"
import { importsEndpoints } from "@inventory/catalog-model/ImportsHandler"
import { catalogMemory } from "@inventory/catalog-model/Memory"
import { CurrentActor } from "@inventory/kernel/Actor"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import {
  type Draft,
  DraftEffect,
  DraftEvent,
  emptyDraft,
  linesShown,
  shown,
  step,
  waiting
} from "../src/Draft.machine.ts"
import { lineWords } from "../src/internal/leftOver.ts"
import { keptForm } from "../src/internal/storedWaiting.ts"

const App = Layer.mergeAll(catalogMemory(), SecureRandom.layerWebCrypto)

const member = (id: string, name: string): Member =>
  Member.make({
    id: MemberId.make(id),
    name,
    role: "admin",
    organizationId: OrganizationId.make("org_prairie"),
    organizationName: "Example Works (test)"
  })
const dana = member("mem_dana", "Dana Whitfield")
const marcus = member("mem_marcus", "Marcus Oyelaran")
const as =
  (who: Member) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, Exclude<R, CurrentActor>> =>
    Effect.provideService(effect, CurrentActor, who)

const headings = ["sku", "name", "category", "uom", "unit_cost", "quantity_on_hand", "Net cost"] as const
const table: StagedTable = {
  fileName: "waited.csv",
  kind: "csv",
  sheet: O.none(),
  headerRowNumber: 1,
  columns: A.map(headings, (label, index) => ({ index, letter: String.fromCharCode(65 + index), label })),
  notes: [],
  rows: A.map(["BBB-0001", "BBB-0002", "BBB-0003"], (sku, index) => ({
    rowNumber: index + 2,
    cells: A.map(headings, (heading) => ({
      text: heading === "sku" ? sku : heading === "name" ? `Rope ${index}` : heading === "category" ? "packaging" : "1"
    }))
  }))
}

const acceptedOut = decisionFromFlags({ out: true, accepted: ["unitCost"] })
const out = decisionFromFlags({ out: true })

/** A view of the import as the screen hands it to the draft. */
const arrived = (view: ImportView): DraftEvent =>
  DraftEvent.ViewArrived({
    revision: view.revision,
    decisions: view.decisions,
    open: view.status === "open",
    confirms: A.filter(view.history, ImportEvent.guards.Confirmed).length,
    matches: A.map(view.choices, (choice) => choice.at),
    takenBack: A.map(view.takenBack, (taken) => ({ revision: taken.revision, rows: taken.rows }))
  })

let uploads = 0

/** The file staged by Marcus, and the server's endpoints with Dana's draft driven against them. */
const opened = Effect.gen(function* () {
  const imports = yield* importsEndpoints
  const { rows, ...head } = table
  uploads += 1
  const begun = yield* imports
    .beginUpload({
      payload: { key: UploadKey.make(`draft-server-${uploads}`), head, rowCount: rows.length, chunkCount: 1 }
    })
    .pipe(as(marcus))
  const { id } = yield* Effect.fromResult(begun)
  const put = yield* imports.putChunk({ params: { id }, payload: { seq: 0, rows } }).pipe(as(marcus))
  yield* Effect.fromResult(put)
  const finished = yield* imports.finishUpload({ params: { id } }).pipe(as(marcus))
  yield* Effect.fromResult(finished)
  const params = { id }
  const read = imports.get({ params }).pipe(as(dana))
  let draft: Draft = emptyDraft
  // What the draft asked to send and has not been answered, by id.
  const sends: Array<Extract<DraftEffect, { readonly _tag: "Send" }>> = []
  const happen = (event: DraftEvent): void => {
    const stepped = step(draft, event)
    draft = stepped.draft
    for (const effect of stepped.effects) if (DraftEffect.$is("Send")(effect)) sends.push(effect)
  }
  /** The last save the draft asked for reaches the server; `lost`: its answer never comes back. */
  const save = Effect.fnUntraced(function* (lost: boolean) {
    const send = O.getOrThrow(A.last(sends))
    sends.length = 0
    const payload = {
      madeOn: send.madeOn,
      ...(R.isEmptyReadonlyRecord(send.over) ? {} : { over: send.over }),
      ...send.delta
    }
    const answer = yield* imports.decide({ params, payload }).pipe(as(dana))
    happen(lost ? DraftEvent.SaveFailed({ id: send.id }) : DraftEvent.SaveAnswered({ id: send.id, ...answer }))
    return answer
  })
  const look = Effect.map(read, (view) => happen(arrived(view)))
  const match = (field: Field, heading: (typeof headings)[number]) =>
    imports
      .match({ params, payload: { field, column: A.findFirstIndex(headings, (one) => one === heading) } })
      .pipe(as(marcus))
  happen(DraftEvent.Opened({ kept: O.none() }))
  yield* look
  return {
    id: id as ImportId,
    happen,
    save,
    look,
    match,
    stored: (row: string) => Effect.map(read, (view) => R.get(view.decisions, row)),
    draft: () => draft,
    reload: () => {
      const kept = keptForm(waiting(draft))
      draft = emptyDraft
      happen(DraftEvent.Opened({ kept }))
    }
  }
})

const decide = (rowId: string, decision: SavedDecisions[string]) =>
  DraftEvent.Decided({ changes: { [rowId]: O.some(decision) } })

describe("a save of hers partly written, its answer lost", () => {
  layer(App)("is found as hers by the server", (it) => {
    it.effect(
      "the accept not applied (its column matched before she pressed): sent again, it writes, and no line",
      () =>
        Effect.gen(function* () {
          const t = yield* opened
          // Marcus matches Unit cost to another column before Dana's screen has read it.
          yield* t.match("unitCost", "Net cost")
          t.happen(decide("row-2", acceptedOut))
          const first = yield* t.save(true)
          expect([first.notApplied.length, yield* t.stored("row-2")]).toEqual([1, O.some(out)])
          // Save again names what the server may hold of it from this tab: nothing, and the decision sent.
          t.happen(DraftEvent.SaveAgain())
          const again = yield* t.save(false)
          expect(again.decidedSince).toEqual([])
          yield* t.look
          expect([R.keys(t.draft().lines), shown(t.draft())["row-2"]]).toEqual([[], out])
        })
    )

    it.effect("the accept taken back by a match after it was written: sent again, it writes, and no line", () =>
      Effect.gen(function* () {
        const t = yield* opened
        t.happen(decide("row-3", acceptedOut))
        yield* t.save(true)
        yield* t.match("unitCost", "Net cost")
        const taken = yield* t.stored("row-3")
        expect(taken).toEqual(O.some(out))
        t.happen(DraftEvent.SaveAgain())
        const again = yield* t.save(false)
        expect(again.decidedSince).toEqual([])
        yield* t.look
        expect(R.keys(t.draft().lines)).toEqual([])
      })
    )

    it.effect("after a reload: what the browser kept goes over what this tab sent, and the server writes it", () =>
      Effect.gen(function* () {
        const t = yield* opened
        t.happen(decide("row-3", acceptedOut))
        yield* t.save(true)
        yield* t.match("unitCost", "Net cost")
        t.reload()
        yield* t.look
        const again = yield* t.save(false)
        expect(again.decidedSince).toEqual([])
        yield* t.look
        expect(R.keys(t.draft().lines)).toEqual([])
      })
    )

    it.effect(
      "decided again after a match took part of it back: the server cannot tell, and the line says what is saved, not whose",
      () =>
        Effect.gen(function* () {
          const t = yield* opened
          t.happen(decide("row-2", acceptedOut))
          yield* t.save(true)
          yield* t.match("unitCost", "Net cost")
          // Her screen reads the match; the resend fails too; then she accepts Unit of measure on the row as well.
          yield* t.look
          yield* t.save(true)
          t.happen(decide("row-2", decisionFromFlags({ out: true, accepted: ["uom"] })))
          const answer = yield* t.save(false)
          // The decision named was sent before the match, the save is dated after it: the server judges it as it was
          // sent, finds it is not what is stored, and names the row decided since.
          expect(A.map(answer.decidedSince, (row) => row.rowId)).toEqual(["row-2"])
          const line = O.getOrThrow(R.get(linesShown(t.draft()), "row-2"))
          const { text } = lineWords({ rowId: "row-2", line, canDecide: true })
          expect([line.since, text]).toEqual([
            false,
            "Row 2: saved now: left out. Yours: left out; accepted the proposal for Unit of measure."
          ])
        })
    )
  })
})
