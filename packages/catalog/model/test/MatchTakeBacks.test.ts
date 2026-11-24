// What a match took back is named (Benjamin, 2026-11-20, group 3: "the screen names it as taken back"): the match keeps
// it with the draft by field and kind, its answer and every later view carry it until the import is confirmed, and its
// audit line counts it. Also, over the twins: a Replace whose row stops reading under the new column is taken back,
// and a confirm carrying it is refused in words naming the column; a request overtaken on every try is a typed refusal
// in the match, the save and the confirm, in words saying what kept changing; a `madeOn` key naming no row of the save
// is not read; and an item stocked or a suggestion stored between a judgement and its write makes it be worked out
// again, never adding a take-back. The D1 side of the same rules is in the app's Rematch and MatchAtomic slow tests.
import { describe, expect, it, layer } from "@effect/vitest"
import { decisionFromFlags, type RowDecisionFlags } from "@inventory/catalog-contract/Decision"
import { ItemId, RowId, SuggestionId } from "@inventory/catalog-contract/Ids"
import type { MatchTakeBack } from "@inventory/catalog-contract/Import"
import { AcceptsTakenBack, DraftBusy, RevisionAhead } from "@inventory/catalog-contract/ImportRejection"
import type { StagedTable } from "@inventory/catalog-contract/Staged"
import { storedSuggestion, suggestedByRule } from "@inventory/catalog-contract/Suggestion"
import {
  confirmItemsChanged,
  type ConfirmWrite,
  decisionsItemsChanged,
  decisionsRematched,
  draftTries,
  ImportStore
} from "@inventory/catalog-model/ImportStore"
import { importsEndpoints } from "@inventory/catalog-model/ImportsHandler"
import { catalogMemory, CatalogMemoryRef } from "@inventory/catalog-model/Memory"
import {
  ItemsAsRead,
  noItemsRead,
  stillAsRead,
  takenBackOfMatch,
  withTakeBacks
} from "@inventory/catalog-model/Rematch"
import { StoreSuggestions, SuggestionStore } from "@inventory/catalog-model/SuggestionStore"
import { Activity } from "@inventory/kernel/Activity"
import { ActivityId } from "@inventory/kernel/Ids"
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as MutableRef from "effect/MutableRef"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Ref from "effect/Ref"
import * as S from "effect/Schema"
import * as SecureRandom from "effect/crypto/SecureRandom"
import { as, dana, marcus } from "./support.ts"
import { stage } from "./support.ts"

const App = Layer.mergeAll(catalogMemory(), SecureRandom.layerWebCrypto)

const headings = ["sku", "name", "category", "uom", "unit_cost", "quantity_on_hand", "Alt code", "Net cost"] as const
const letters = ["A", "B", "C", "D", "E", "F", "G", "H"]
type Line = Partial<Record<(typeof headings)[number], string>>
const column = (heading: (typeof headings)[number]): number =>
  O.getOrThrow(A.findFirstIndex(headings, (candidate) => candidate === heading))

const tableOf = (fileName: string, lines: ReadonlyArray<Line>): StagedTable => ({
  fileName,
  kind: "csv",
  sheet: O.none(),
  headerRowNumber: 1,
  columns: A.map(headings, (label, index) => ({ index, letter: O.getOrElse(A.get(letters, index), () => "A"), label })),
  notes: [],
  rows: A.map(lines, (line, index) => ({
    rowNumber: index + 2,
    cells: A.map(headings, (heading) => ({ text: line[heading] ?? "" }))
  }))
})

const item = { category: "packaging", uom: "EA", quantity_on_hand: "10" }
const stocked = tableOf("stocked.csv", [
  { ...item, sku: "AAA-0001", name: "Oak Crate", unit_cost: "12.50" },
  { ...item, sku: "AAA-0002", name: "Steel Bolt", unit_cost: "3" }
])
/** Rows 2 and 3 have a stored item; rows 4 and 5 share a SKU; row 6 is new. */
const reviewed = tableOf("reviewed.csv", [
  { ...item, sku: "AAA-0001", name: "Oak Crate", unit_cost: "99.00", "Alt code": "ZZZ-0001" },
  { ...item, sku: "AAA-0002", name: "Steel Bolt XL", unit_cost: "3", "Alt code": "ZZZ-0002", "Net cost": "call" },
  { ...item, sku: "BBB-0001", name: "Twin A", unit_cost: "1", "Alt code": "YYY-0001" },
  { ...item, sku: "BBB-0001", name: "Twin B", unit_cost: "2", "Alt code": "YYY-0002" },
  { ...item, sku: "CCC-0001", name: "Hemp Rope", unit_cost: "4", "Alt code": "XXX-0001" }
])

const flags = (set: Readonly<Record<string, RowDecisionFlags.Encoded>>) => R.map(set, decisionFromFlags)

/** The two items stocked and confirmed, then `table` staged: the import to decide and match on. */
const seeded = Effect.fn("seeded")(function* (table: StagedTable) {
  const imports = yield* importsEndpoints
  const first = yield* stage(stocked).pipe(as(marcus))
  yield* imports
    .commit({ params: { id: first.id }, payload: { revision: first.revision, madeOn: {}, set: {}, clear: [] } })
    .pipe(as(marcus))
  const view = yield* stage(table).pipe(as(marcus))
  return { imports, view, params: { id: view.id } }
})

describe("what a match took back from the stored decisions", () => {
  layer(App)(
    "is kept by field and kind, named in every view and in the audit line, and let go at the confirm",
    (it) => {
      it.effect("a SKU re-match: the Replaces and Keep-storeds, and the keeps of one of two, each with its rows", () =>
        Effect.gen(function* () {
          const { imports, view, params } = yield* seeded(reviewed)
          const set = flags({
            "row-3": { stored: "replace" },
            "row-2": { stored: "keep" },
            "row-4": { kept: true },
            "row-5": { out: true, kept: true },
            "row-6": { edits: { name: "Hemp Rope 10m" } }
          })
          yield* imports
            .decide({ params, payload: { over: {}, madeOn: R.map(set, () => view.revision), set, clear: [] } })
            .pipe(as(marcus))
          const matched = yield* imports
            .match({ params, payload: { field: "sku", column: O.some(column("Alt code")) } })
            .pipe(as(dana))
          const named = [
            {
              revision: matched.revision,
              by: "Dana Whitfield",
              field: "sku",
              matched: "sku",
              reads: true,
              kind: "stored",
              count: 2,
              rows: ["row-2", "row-3"],
              // Which decision each part was taken from: Marcus's save, at the revision it moved the draft to.
              saved: { "row-2": view.revision + 1, "row-3": view.revision + 1 }
            },
            {
              revision: matched.revision,
              by: "Dana Whitfield",
              field: "sku",
              matched: "sku",
              reads: true,
              kind: "twin",
              count: 2,
              rows: ["row-4", "row-5"],
              saved: { "row-4": view.revision + 1, "row-5": view.revision + 1 }
            }
          ]
          // The match's own answer names them, and so does every later view, whoever reads it.
          expect(matched.takenBack).toEqual(named)
          expect((yield* imports.get({ params }).pipe(as(marcus))).takenBack).toEqual(named)
          // The audit line counts them by kind.
          const ref = yield* CatalogMemoryRef
          const line = O.getOrThrow(
            A.findLast((yield* Ref.get(ref)).activity, (entry) => entry.action === "Matched a column")
          )
          expect(line.detail).toBe(
            `SKU reads column G "Alt code" in reviewed.csv; took back 2 Replaces or Keep-storeds, 2 keeps of one of two`
          )
          // A second match adds its own, after the first.
          const again = yield* imports
            .match({ params, payload: { field: "sku", column: O.some(column("sku")) } })
            .pipe(as(dana))
          expect(again.takenBack).toEqual(named)
          // Confirmed, there is nothing left to name; opened again, nothing comes back.
          const confirmed = yield* imports
            .commit({ params, payload: { revision: again.revision, madeOn: {}, set: {}, clear: [] } })
            .pipe(as(marcus))
          expect(confirmed.takenBack).toEqual([])
          const reopened = yield* imports.reopen({ params }).pipe(as(marcus))
          expect([reopened.status, reopened.takenBack]).toEqual(["open", []])
        })
      )

      it.effect("names at most 200 rows, the first in the file's order, and counts them all", () =>
        Effect.gen(function* () {
          const many = tableOf(
            "many.csv",
            A.makeBy(205, (index) => ({ ...item, sku: `DDD-${1000 + index}`, name: `Part ${index}`, unit_cost: "1" }))
          )
          const { imports, view, params } = yield* seeded(many)
          // Every row accepted a proposal for the unit, in no particular order.
          const set = R.fromEntries(
            A.map(
              A.reverse(A.makeBy(205, (index) => index + 2)),
              (row) => [`row-${row}`, decisionFromFlags({ accepted: ["uom"] })] as const
            )
          )
          yield* imports
            .decide({ params, payload: { over: {}, madeOn: R.map(set, () => view.revision), set, clear: [] } })
            .pipe(as(marcus))
          const matched = yield* imports
            .match({ params, payload: { field: "uom", column: O.some(column("Net cost")) } })
            .pipe(as(dana))
          const [only] = matched.takenBack
          expect([matched.takenBack.length, only?.field, only?.kind, only?.count, only?.rows.length]).toEqual([
            1,
            "uom",
            "accept",
            205,
            200
          ])
          expect([only?.rows[0], only?.rows[8], only?.rows[9], only?.rows[199]]).toEqual([
            "row-2",
            "row-10",
            "row-11",
            "row-201"
          ])
        })
      )
    }
  )
})

describe("a Replace across a re-match of another column", () => {
  layer(App)("Refuse if it changes the row", (it) => {
    it.effect(
      "is taken back when the row stops reading under the new column, though no difference of that field changed",
      () =>
        Effect.gen(function* () {
          // Row 3 differs from its stored item on the name only; its cost reads 3 as stored. "Net cost" says "call".
          const { imports, view, params } = yield* seeded(reviewed)
          const replace = flags({ "row-3": { stored: "replace" } })
          yield* imports
            .decide({ params, payload: { over: {}, madeOn: { "row-3": view.revision }, set: replace, clear: [] } })
            .pipe(as(marcus))
          const matched = yield* imports
            .match({ params, payload: { field: "unitCost", column: O.some(column("Net cost")) } })
            .pipe(as(dana))
          expect(R.get(matched.decisions, "row-3")).toEqual(O.some(decisionFromFlags({})))
          expect(A.map(matched.takenBack, (entry) => [entry.field, entry.kind, entry.rows])).toEqual([
            ["unitCost", "stored", ["row-3"]]
          ])
          // A save of the same Replace made before the match is refused the same way.
          const saved = yield* imports
            .decide({ params, payload: { over: {}, madeOn: { "row-3": view.revision }, set: replace, clear: [] } })
            .pipe(as(marcus))
          expect(saved.notApplied).toEqual([{ rowId: "row-3", field: "unitCost", kind: "stored" }])
          // A confirm carrying it is refused, in words that name the column matched again and the rows resting on it.
          const refused = yield* Effect.flip(
            imports
              .commit({
                params,
                payload: { revision: saved.revision, madeOn: { "row-3": view.revision }, set: replace, clear: [] }
              })
              .pipe(as(marcus))
          )
          expect(S.is(AcceptsTakenBack)(refused) ? [refused.reason, refused.accepts] : refused).toEqual([
            "Unit cost was matched again after you decided 1 row that rests on it. Nothing was imported: look at the row it changed, then confirm again.",
            [{ rowId: "row-3", field: "unitCost", kind: "stored" }]
          ])
        })
    )

    it.effect(
      "is taken back when the row read and agreed with its stored item, and stops reading: no difference on either side",
      () =>
        Effect.gen(function* () {
          // Row 2 says exactly what the stored item says under "unit_cost"; under "Net cost" its cost does not read.
          const agreeing = tableOf("agreeing.csv", [
            { ...item, sku: "AAA-0002", name: "Steel Bolt", unit_cost: "3", "Net cost": "call" }
          ])
          const { imports, view, params } = yield* seeded(agreeing)
          yield* imports
            .decide({
              params,
              payload: {
                over: {},
                madeOn: { "row-2": view.revision },
                set: flags({ "row-2": { stored: "keep" } }),
                clear: []
              }
            })
            .pipe(as(marcus))
          const matched = yield* imports
            .match({ params, payload: { field: "unitCost", column: O.some(column("Net cost")) } })
            .pipe(as(dana))
          expect(R.get(matched.decisions, "row-2")).toEqual(O.some(decisionFromFlags({})))
        })
    )

    it.effect(
      "is taken back when one match moves two fields and the row stops reading under both: the row is judged as a whole",
      () =>
        Effect.gen(function* () {
          // Row 2 reads (cost 4.58, quantity 10) and differs from its stored item on the name and the cost.
          const table = tableOf("displaced.csv", [
            { ...item, sku: "AAA-0002", name: "Steel Bolt XL", unit_cost: "4.58", "Net cost": "9.99" }
          ])
          const replace = flags({ "row-2": { stored: "replace" } })
          const { imports, view, params } = yield* seeded(table)
          yield* imports
            .decide({ params, payload: { over: {}, madeOn: { "row-2": view.revision }, set: replace, clear: [] } })
            .pipe(as(marcus))
          // The quantity is pointed at the cost's column: "4.58" is no count, and the cost reads no column.
          const matched = yield* imports
            .match({ params, payload: { field: "quantityOnHand", column: O.some(column("unit_cost")) } })
            .pipe(as(dana))
          expect(R.get(matched.decisions, "row-2")).toEqual(O.some(decisionFromFlags({})))
          expect(A.map(matched.takenBack, (entry) => [entry.kind, entry.rows])).toEqual([["stored", ["row-2"]]])
          // A save of the same Replace made before it is refused the same way, after the cost reads a column again too.
          const saved = yield* imports
            .decide({ params, payload: { over: {}, madeOn: { "row-2": view.revision }, set: replace, clear: [] } })
            .pipe(as(marcus))
          expect(A.map(saved.notApplied, (taken) => [taken.rowId, taken.kind])).toEqual([["row-2", "stored"]])
          yield* imports
            .match({ params, payload: { field: "unitCost", column: O.some(column("Net cost")) } })
            .pipe(as(dana))
          const later = yield* imports
            .decide({ params, payload: { over: {}, madeOn: { "row-2": view.revision }, set: replace, clear: [] } })
            .pipe(as(marcus))
          expect(A.map(later.notApplied, (taken) => [taken.rowId, taken.kind])).toEqual([["row-2", "stored"]])
        })
    )
  })
})

describe("which field was matched by hand, and whether the field named reads a column since", () => {
  layer(App)("is kept with what a match took back", (it) => {
    it.effect("a field that lost its column to another, a field cleared, and one matched to another column", () =>
      Effect.gen(function* () {
        const { imports, view, params } = yield* seeded(reviewed)
        const accepted = flags({ "row-2": { accepted: ["uom", "name"] } })
        const accept = (on: number) =>
          imports
            .decide({ params, payload: { over: {}, madeOn: { "row-2": on }, set: accepted, clear: [] } })
            .pipe(as(marcus))
        const said = (entries: ReadonlyArray<MatchTakeBack>, revision: number) =>
          A.map(
            A.filter(entries, (entry) => entry.revision === revision),
            (entry) => [entry.field, entry.matched, entry.reads]
          )
        yield* accept(view.revision)
        // Name takes the column headed "uom": the unit reads none since.
        const displaced = yield* imports
          .match({ params, payload: { field: "name", column: O.some(column("uom")) } })
          .pipe(as(dana))
        expect(said(displaced.takenBack, displaced.revision)).toEqual([
          ["name", "name", true],
          ["uom", "name", false]
        ])
        yield* accept(displaced.revision)
        const cleared = yield* imports.match({ params, payload: { field: "name", column: O.none() } }).pipe(as(dana))
        // Cleared, Name gives the column back to the unit, which reads it by its heading again.
        expect(said(cleared.takenBack, cleared.revision)).toEqual([
          ["name", "name", false],
          ["uom", "name", true]
        ])
      })
    )

    it.effect("an entry stored before either was kept still reads, beside one with both", () =>
      Effect.gen(function* () {
        const { imports, view, params } = yield* seeded(reviewed)
        const ref = yield* CatalogMemoryRef
        const older = '{"revision":1,"by":"Dana Whitfield","field":"uom","kind":"accept","count":1,"rows":["row-4"]}'
        yield* Ref.update(ref, (state) => ({
          ...state,
          drafts: A.map(state.drafts, (entry) =>
            entry.draft.id === view.id ? { ...entry, draft: { ...entry.draft, takenBackJson: `[${older}]` } } : entry
          )
        }))
        const accepted = flags({ "row-2": { accepted: ["uom"] } })
        yield* imports
          .decide({ params, payload: { over: {}, madeOn: { "row-2": view.revision }, set: accepted, clear: [] } })
          .pipe(as(marcus))
        const matched = yield* imports.match({ params, payload: { field: "uom", column: O.none() } }).pipe(as(dana))
        expect(A.map(matched.takenBack, (entry) => [entry.rows, "matched" in entry, entry.reads])).toEqual([
          [["row-4"], false, undefined],
          [["row-2"], true, false]
        ])
      })
    )
  })
})

describe("a draft that keeps changing under a request", () => {
  layer(App)("is a typed refusal after the same number of tries in the match and the save", (it) => {
    it.effect("the twin's match gives up after `draftTries`, never retrying without end", () =>
      Effect.gen(function* () {
        const { imports, view, params } = yield* seeded(reviewed)
        yield* imports
          .decide({
            params,
            payload: {
              over: {},
              madeOn: { "row-3": view.revision },
              set: flags({ "row-3": { stored: "replace" } }),
              clear: []
            }
          })
          .pipe(as(marcus))
        const store = yield* ImportStore
        const ref = yield* CatalogMemoryRef
        const found = yield* store.find(dana.organizationId, view.id)
        const draft = O.getOrThrow(found)
        // Every time the review is asked, somebody changes the catalog: every try is overtaken.
        const asked = MutableRef.make(0)
        const answer = yield* store.matchColumn(
          dana,
          draft,
          { field: "unitCost", column: column("Net cost") },
          "Unit cost",
          () =>
            Effect.as(
              Effect.andThen(
                Effect.sync(() => MutableRef.update(asked, (n) => n + 1)),
                Ref.update(ref, (state) => ({ ...state, activity: [...state.activity] }))
              ),
              { changed: [], read: noItemsRead }
            )
        )
        expect([answer, MutableRef.get(asked)]).toEqual(["busy", draftTries])
        // Nothing was written.
        expect((yield* imports.get({ params }).pipe(as(marcus))).revision).toBe(draft.revision)
      })
    )

    it.effect("the match and the save answer `DraftBusy`, with nothing written", () =>
      Effect.gen(function* () {
        const { params } = yield* seeded(reviewed)
        const inner = yield* ImportStore
        const tried = MutableRef.make(0)
        // A store whose every try is overtaken: a match always busy, a save always finding the columns matched again.
        const overtaken = ImportStore.of({
          ...inner,
          matchColumn: Effect.fn("overtaken.matchColumn")(function* () {
            return yield* Effect.succeed("busy" as const)
          }),
          decide: Effect.fn("overtaken.decide")(function* () {
            MutableRef.update(tried, (n) => n + 1)
            return yield* Effect.succeed(decisionsRematched)
          })
        })
        const imports = yield* importsEndpoints.pipe(Effect.provideService(ImportStore, overtaken))
        const saving = yield* Effect.flip(
          imports
            .decide({ params, payload: { over: {}, madeOn: {}, set: flags({ "row-2": { out: true } }), clear: [] } })
            .pipe(as(marcus))
        )
        const matching = yield* Effect.flip(
          imports.match({ params, payload: { field: "sku", column: O.some(column("Alt code")) } }).pipe(as(dana))
        )
        expect([S.is(DraftBusy)(saving), MutableRef.get(tried), S.is(DraftBusy)(matching)]).toEqual([
          true,
          draftTries,
          true
        ])
        // The save gave up because the import kept being matched; the match cannot tell which kept changing.
        expect([
          S.is(DraftBusy)(saving) ? saving.reason : "",
          S.is(DraftBusy)(matching) ? matching.reason : ""
        ]).toEqual([
          "This import kept being changed (in another tab or by someone else) while your request was worked out, so nothing was written. Try again in a moment.",
          "This import, or items it would change, kept being changed (in another tab, by someone else, by another import or on the Items page) while your request was worked out, so nothing was written. Try again in a moment."
        ])
      })
    )

    it.effect("a save and a confirm whose items kept changing say so, not that the import did", () =>
      Effect.gen(function* () {
        const { view, params } = yield* seeded(reviewed)
        const inner = yield* ImportStore
        // A store whose every save and confirm finds an item its judgement read changed since.
        const overtaken = ImportStore.of({
          ...inner,
          decide: Effect.fn("overtaken.decide")(function* () {
            return yield* Effect.succeed(decisionsItemsChanged)
          }),
          commit: Effect.fn("overtaken.commit")(function* () {
            return yield* Effect.succeed(confirmItemsChanged)
          })
        })
        const imports = yield* importsEndpoints.pipe(Effect.provideService(ImportStore, overtaken))
        const saving = yield* Effect.flip(
          imports
            .decide({ params, payload: { over: {}, madeOn: {}, set: flags({ "row-2": { out: true } }), clear: [] } })
            .pipe(as(marcus))
        )
        const confirming = yield* Effect.flip(
          imports
            .commit({ params, payload: { revision: view.revision, madeOn: {}, set: {}, clear: [] } })
            .pipe(as(marcus))
        )
        const words =
          "Items this would change kept being changed elsewhere (by another import, on the Items page or by a take-back), or suggestions kept arriving for this import, while your request was worked out, so nothing was written. The import itself did not change. Try again in a moment."
        expect([
          S.is(DraftBusy)(saving) ? saving.reason : "",
          S.is(DraftBusy)(confirming) ? confirming.reason : ""
        ]).toEqual([words, words])
      })
    )
  })
})

describe("a madeOn key that names no row of the save", () => {
  layer(App)("is not read", (it) => {
    it.effect("a save and a confirm are judged on the rows they set only, and not refused for a key beside them", () =>
      Effect.gen(function* () {
        const { imports, view, params } = yield* seeded(reviewed)
        const set = flags({ "row-2": { out: true } })
        const saved = yield* imports
          .decide({
            params,
            payload: { over: {}, madeOn: { "row-2": view.revision, "row-99": 999_999 }, set, clear: [] }
          })
          .pipe(as(marcus))
        expect(saved.changed).toBe(true)
        const confirmed = yield* imports
          .commit({
            params,
            payload: {
              revision: saved.revision,
              madeOn: { "row-2": saved.revision, "not-a-row": 999_999 },
              set,
              clear: []
            }
          })
          .pipe(as(marcus))
        expect(confirmed.status).toBe("imported")
        // A row it does set, named on a revision the draft has not reached, is still refused.
        const { params: other } = yield* seeded(reviewed)
        const ahead = yield* Effect.flip(
          imports
            .decide({ params: other, payload: { over: {}, madeOn: { "row-2": 999_999 }, set, clear: [] } })
            .pipe(as(marcus))
        )
        expect(S.is(RevisionAhead)(ahead)).toBe(true)
      })
    )
  })
})

describe("what a draft keeps of its matches' take-backs", () => {
  const entry = (revision: number): MatchTakeBack => ({
    revision,
    by: "Dana Whitfield",
    field: "unitCost",
    kind: "accept",
    count: 1,
    rows: [RowId.make("row-2")]
  })
  it("keeps every entry while the import is open: a 101st does not let go of the first", () => {
    const kept = A.makeBy(100, (index) => entry(index + 1))
    const after = withTakeBacks({ kept, added: [entry(101)] })
    expect([after.length, A.head(after), A.last(after)]).toEqual([101, O.some(entry(1)), O.some(entry(101))])
  })

  it("counts only the rows it can name: a taken-back key that is not a row id is neither counted nor named", () => {
    const entries = takenBackOfMatch({
      revision: 13,
      by: "Dana Whitfield",
      matched: "sku",
      reads: () => true,
      savedAt: { "row-9": 11, "row-4": 6 },
      notApplied: [
        { rowId: "row-9", field: "sku", kind: "stored" },
        { rowId: "not-a-row", field: "sku", kind: "stored" },
        { rowId: "row-4", field: "sku", kind: "stored" },
        // A field and kind with no row the screen can show has no entry at all.
        { rowId: "row-0", field: "uom", kind: "accept" }
      ]
    })
    expect(A.map(entries, (taken) => [taken.field, taken.kind, taken.count, taken.rows, taken.saved])).toEqual([
      ["sku", "stored", 2, ["row-4", "row-9"], { "row-4": 6, "row-9": 11 }]
    ])
  })
})

describe("what changes between a judgement of the decisions and its write", () => {
  // Row 2 costs 9.00 under "unit_cost" and 3 under "Net cost"; nothing is stocked under its SKU when it is judged.
  // Stocked at 3, a Replace made while the cost read "unit_cost" would compare otherwise under "Net cost": a take-back
  // comes only from a column matched again after the decision, never from an item stocked in between.
  const lone = tableOf("lone.csv", [
    { ...item, sku: "AAA-0002", name: "Steel Bolt", unit_cost: "9.00", "Net cost": "3" }
  ])
  const replace = flags({ "row-2": { stored: "replace" } })

  /**
   * The file staged and its cost matched to "Net cost"; once, just before the store's save or confirm (`step`), the
   * stocking import is confirmed (`stock`) or a suggestion is stored for the import (`suggest`). `tries` counts the
   * store's saves or confirms.
   */
  const windowed = Effect.fn("windowed")(function* (step: "decide" | "commit", between: "stock" | "suggest") {
    const plain = yield* importsEndpoints
    const inner = yield* ImportStore
    const suggestions = yield* SuggestionStore
    const first = yield* stage(stocked).pipe(as(marcus))
    const view = yield* stage(lone).pipe(as(marcus))
    const params = { id: view.id }
    const matched = yield* plain
      .match({ params, payload: { field: "unitCost", column: O.some(column("Net cost")) } })
      .pipe(as(dana))
    const at = yield* DateTime.now
    const stock = plain
      .commit({ params: { id: first.id }, payload: { revision: first.revision, madeOn: {}, set: {}, clear: [] } })
      .pipe(as(marcus), Effect.asVoid, Effect.orDie)
    const suggest = Effect.asVoid(
      suggestions.store(
        StoreSuggestions.make({
          draft: view.id,
          suggestions: [
            storedSuggestion({
              id: SuggestionId.make("00000000-0000-4000-8000-000000000201"),
              made: {
                kind: "name",
                rowId: RowId.make("row-2"),
                rowNumber: 2,
                from: "Steel Bolt",
                to: "Steel Bolt M6",
                by: suggestedByRule,
                confidence: "low",
                basis: "A suggestion stored while the request was worked out"
              }
            })
          ],
          audit: Activity.make({
            id: ActivityId.make("00000000-0000-4000-8000-000000000202"),
            organizationId: marcus.organizationId,
            actorId: marcus.id,
            actorName: marcus.name,
            action: "Asked for suggestions",
            detail: "",
            agent: O.none(),
            createdAt: at
          })
        })
      )
    )
    const waiting = MutableRef.make(true)
    const tries = MutableRef.make(0)
    const once = Effect.suspend(() => {
      MutableRef.update(tries, (n) => n + 1)
      if (!MutableRef.get(waiting)) return Effect.void
      MutableRef.set(waiting, false)
      return between === "stock" ? stock : suggest
    })
    const windowedStore = ImportStore.of({
      ...inner,
      decide: Effect.fn("windowed.decide")(function* (...args: Parameters<ImportStore["Service"]["decide"]>) {
        if (step === "decide") yield* once
        return yield* inner.decide(...args)
      }),
      commit: Effect.fn("windowed.commit")(function* (write: ConfirmWrite) {
        if (step === "commit") yield* once
        return yield* inner.commit(write)
      })
    })
    const imports = yield* importsEndpoints.pipe(Effect.provideService(ImportStore, windowedStore))
    return { imports, view, params, matched, tries }
  })

  // Each on its own twins: the item one stocks must not be there already when the other is judged.
  layer(App)("an item stocked between a save's judgement and its write", (it) => {
    it.effect("the save is worked out again, and the item stocked takes nothing back: the Replace stands", () =>
      Effect.gen(function* () {
        const { imports, view, params, tries } = yield* windowed("decide", "stock")
        const saved = yield* imports
          .decide({ params, payload: { over: {}, madeOn: { "row-2": view.revision }, set: replace, clear: [] } })
          .pipe(as(marcus))
        expect([saved.notApplied, MutableRef.get(tries)]).toEqual([[], 2])
        const after = yield* imports.get({ params }).pipe(as(marcus))
        expect(R.get(after.decisions, "row-2")).toEqual(O.some(decisionFromFlags({ stored: "replace" })))
      })
    )
  })

  layer(App)("an item stocked between a confirm's judgement and its write", (it) => {
    it.effect("the confirm is worked out again, the item stocked takes nothing back, and it is imported", () =>
      Effect.gen(function* () {
        const { imports, view, params, matched, tries } = yield* windowed("commit", "stock")
        const confirmed = yield* imports
          .commit({
            params,
            payload: { revision: matched.revision, madeOn: { "row-2": view.revision }, set: replace, clear: [] }
          })
          .pipe(as(marcus))
        expect([confirmed.status, MutableRef.get(tries)]).toEqual(["imported", 2])
      })
    )
  })

  layer(App)("a suggestion stored between a save's judgement and its write", (it) => {
    it.effect("the save is worked out again: storing a suggestion moves no revision, and is still caught", () =>
      Effect.gen(function* () {
        const { imports, view, params, tries } = yield* windowed("decide", "suggest")
        const saved = yield* imports
          .decide({ params, payload: { over: {}, madeOn: { "row-2": view.revision }, set: replace, clear: [] } })
          .pipe(as(marcus))
        expect([saved.notApplied, MutableRef.get(tries)]).toEqual([[], 2])
      })
    )
  })

  layer(App)("a suggestion stored between a confirm's judgement and its write", (it) => {
    it.effect("the confirm is worked out again, and imported", () =>
      Effect.gen(function* () {
        const { imports, view, params, matched, tries } = yield* windowed("commit", "suggest")
        const confirmed = yield* imports
          .commit({
            params,
            payload: { revision: matched.revision, madeOn: { "row-2": view.revision }, set: replace, clear: [] }
          })
          .pipe(as(marcus))
        expect([confirmed.status, MutableRef.get(tries)]).toEqual(["imported", 2])
      })
    )
  })
})

describe("what a judgement read, and whether it is still so", () => {
  const item = { id: "00000000-0000-4000-8000-000000000401", sku: "AAA-0002", revision: 1 }
  const suggestion = "00000000-0000-4000-8000-000000000402"
  const read = ItemsAsRead.make({
    asked: true,
    keys: ["AAA-0002"],
    items: [{ id: ItemId.make(item.id), revision: 1 }],
    created: [{ rowNumber: 3, part: 0 }],
    suggestions: [SuggestionId.make(suggestion)]
  })
  const now = { items: [item], created: [{ rowNumber: 3, part: 0 }], suggestions: [suggestion] }

  it("is a schema of its own: an item's id is an ItemId, and nothing read is a value it built", () => {
    expect([S.is(ItemsAsRead)(read), S.is(ItemsAsRead)(noItemsRead), noItemsRead.asked]).toEqual([true, true, false])
    expect(S.is(ItemsAsRead)({ ...read, items: [{ id: "item-1", revision: 1 }] })).toBe(false)
  })

  it("is still so only while the items, the created rows and the suggestions it read are all as read", () => {
    const states = [
      now,
      { ...now, items: [{ ...item, revision: 2 }] },
      { ...now, created: [] },
      { ...now, suggestions: [suggestion, "00000000-0000-4000-8000-000000000403"] }
    ]
    expect(A.map(states, stillAsRead(read))).toEqual([true, false, false, false])
    // Nothing read: nothing is checked.
    expect(stillAsRead(noItemsRead)({ ...now, created: [] })).toBe(true)
  })
})
