// What a match took back is named (Benjamin, 2026-11-20, group 3: "the screen names it as taken back"): the match keeps
// it with the draft by field and kind, its answer and every later view carry it until the import is confirmed, and its
// audit line counts it. Also, over the twins: a Replace whose row stops reading under the new column is taken back,
// a draft overtaken on every try is a typed refusal in both the match and the save, and a `madeOn` key naming no row
// of the save is not read. The D1 side of the same rules is in the app's Rematch and MatchAtomic slow tests.
import { describe, expect, layer } from "@effect/vitest"
import { decisionFromFlags, type RowDecisionFlags } from "@inventory/catalog-contract/Decision"
import { DraftBusy, RevisionAhead } from "@inventory/catalog-contract/ImportRejection"
import type { StagedTable } from "@inventory/catalog-contract/Staged"
import { decisionsRematched, draftTries, ImportStore } from "@inventory/catalog-model/ImportStore"
import { importsEndpoints } from "@inventory/catalog-model/ImportsHandler"
import { catalogMemory, CatalogMemoryRef } from "@inventory/catalog-model/Memory"
import * as A from "effect/Array"
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

const flags = (set: Readonly<Record<string, RowDecisionFlags>>) => R.map(set, decisionFromFlags)

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
            .decide({ params, payload: { madeOn: R.map(set, () => view.revision), set, clear: [] } })
            .pipe(as(marcus))
          const matched = yield* imports
            .match({ params, payload: { field: "sku", column: O.some(column("Alt code")) } })
            .pipe(as(dana))
          const named = [
            {
              revision: matched.revision,
              by: "Dana Whitfield",
              field: "sku",
              kind: "stored",
              count: 2,
              rows: ["row-2", "row-3"]
            },
            {
              revision: matched.revision,
              by: "Dana Whitfield",
              field: "sku",
              kind: "twin",
              count: 2,
              rows: ["row-4", "row-5"]
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
            .decide({ params, payload: { madeOn: R.map(set, () => view.revision), set, clear: [] } })
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
            .decide({ params, payload: { madeOn: { "row-3": view.revision }, set: replace, clear: [] } })
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
            .decide({ params, payload: { madeOn: { "row-3": view.revision }, set: replace, clear: [] } })
            .pipe(as(marcus))
          expect(saved.notApplied).toEqual([{ rowId: "row-3", field: "unitCost", kind: "stored" }])
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
              payload: { madeOn: { "row-2": view.revision }, set: flags({ "row-2": { stored: "keep" } }), clear: [] }
            })
            .pipe(as(marcus))
          const matched = yield* imports
            .match({ params, payload: { field: "unitCost", column: O.some(column("Net cost")) } })
            .pipe(as(dana))
          expect(R.get(matched.decisions, "row-2")).toEqual(O.some(decisionFromFlags({})))
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
            payload: { madeOn: { "row-3": view.revision }, set: flags({ "row-3": { stored: "replace" } }), clear: [] }
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
              { changed: [], read: { keys: [], items: [] } }
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
            .decide({ params, payload: { madeOn: {}, set: flags({ "row-2": { out: true } }), clear: [] } })
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
          .decide({ params, payload: { madeOn: { "row-2": view.revision, "row-99": 999_999 }, set, clear: [] } })
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
          imports.decide({ params: other, payload: { madeOn: { "row-2": 999_999 }, set, clear: [] } }).pipe(as(marcus))
        )
        expect(S.is(RevisionAhead)(ahead)).toBe(true)
      })
    )
  })
})
