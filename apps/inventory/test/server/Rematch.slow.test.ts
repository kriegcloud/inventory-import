import { assertTrue } from "@effect/vitest/utils"
// What a re-match of a column takes back besides accepts (Benjamin, 2026-11-20: "Server refuses, says so" for a SKU
// re-match and an undone fix, "Refuse if it changes the row" for a Replace across another re-match), and a field moved
// off its column by another field's match; what a match by hand to the column a field already reads takes back: nothing
// (2026-11-21, "Only when it changes"); and a Replace on an import matched before moves were kept ("Take it back, say
// so"). On the real handlers and SQL, a fresh D1 for each rule. Each rule at a save
// (named in `notApplied`), at a confirm (refused whole, nothing imported) and at the match itself (a stored decision
// dropped in the match's own batch). The same scenarios run over the twins in the catalog model's StaleDecisions test.
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as HttpApiTest from "effect/http-api/HttpApiTest"
import * as SqlClient from "effect/sql/SqlClient"
import { decisionFromFlags, type RowDecisionFlags } from "@inventory/catalog-contract/Decision"
import type { ImportView } from "@inventory/catalog-contract/Import"
import { AcceptsTakenBack } from "@inventory/catalog-contract/ImportRejection"
import type { Field, StagedTable } from "@inventory/catalog-contract/Staged"
import { itemsOfRow, review } from "@inventory/catalog-model/Review"
import { Api } from "../../src/api/v1/Api.ts"
import { as, TypedApp } from "./support/app.ts"
import { upload } from "./support/upload.ts"

const headings = [
  "sku",
  "name",
  "description",
  "category",
  "uom",
  "unit_cost",
  "quantity_on_hand",
  "Alt code",
  "List cost",
  "Net cost",
  "Pack unit"
] as const
type Heading = (typeof headings)[number]
type Line = Record<Heading, string>
const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"]
const column = (heading: Heading): number => {
  const valueOption = A.findFirstIndex(headings, (candidate) => candidate === heading)
  assertTrue(O.isSome(valueOption), "expected value to be present")
  const value = valueOption.value
  return value
}

const tableOf = (fileName: string, lines: ReadonlyArray<Line>): StagedTable => ({
  fileName,
  kind: "csv",
  sheet: O.none(),
  headerRowNumber: 1,
  columns: A.map(A.zip(headings, letters), ([label, letter], index) => ({ index, letter, label })),
  notes: [],
  rows: A.map(lines, (line, index) => ({
    rowNumber: index + 2,
    cells: A.map(headings, (heading) => ({ text: line[heading], shown: O.none() }))
  }))
})

const item = {
  sku: "",
  name: "",
  description: "",
  unit_cost: "",
  "Alt code": "",
  "List cost": "",
  "Net cost": "",
  "Pack unit": "",
  category: "packaging",
  uom: "EA",
  quantity_on_hand: "10"
}
/** What the organization already has: two items, confirmed from a first file. */
const stocked = tableOf("stocked.csv", [
  { ...item, sku: "AAA-0001", name: "Oak Crate", unit_cost: "12.50" },
  { ...item, sku: "AAA-0002", name: "Steel Bolt", unit_cost: "3" }
])
/**
 * The file reviewed. Row 2's cost differs from the stored item's in every cost column; row 3's cost reads the stored
 * 3 only in "List cost". Rows 4 and 5 share a SKU, but not an alternative code. Row 6 has a unit a rule fixes.
 */
const reviewed = tableOf("reviewed.csv", [
  {
    ...item,
    sku: "AAA-0001",
    name: "Oak Crate",
    unit_cost: "99.00",
    "List cost": "99.00",
    "Net cost": "99.00",
    "Alt code": "ZZZ-0001"
  },
  {
    ...item,
    sku: "AAA-0002",
    name: "Steel Bolt",
    unit_cost: "9.00",
    "List cost": "3",
    "Net cost": "9.00",
    "Alt code": "ZZZ-0002"
  },
  { ...item, sku: "BBB-0001", name: "Twin A", unit_cost: "1", "Alt code": "YYY-0001" },
  { ...item, sku: "BBB-0001", name: "Twin B", unit_cost: "2", "Alt code": "YYY-0002" },
  {
    ...item,
    sku: "CCC-0001",
    name: "Hemp Rope",
    uom: "each",
    unit_cost: "4",
    "Alt code": "XXX-0001",
    "Pack unit": "kg"
  }
])

const marcus = as("mem_marcus")
const dana = as("mem_dana")

/** The two items stocked, then the reviewed file staged twice: one import to save and confirm on, one to match on. */
const seeded = Effect.gen(function* () {
  const client = yield* HttpApiTest.groups(Api, ["imports", "items", "activity"])
  const first = yield* upload({ client, table: stocked }).pipe(marcus)
  yield* client.imports
    .commit({ params: { id: first.id }, payload: { revision: first.revision, madeOn: {}, set: {}, clear: [] } })
    .pipe(marcus)
  const saving = yield* upload({ client, table: reviewed }).pipe(marcus)
  const matching = yield* upload({ client, table: reviewed }).pipe(marcus)
  return { client, saving, matching }
})

const flags = (set: Readonly<Record<string, RowDecisionFlags.Encoded>>) => R.map(set, decisionFromFlags)

/**
 * One rule end to end: `rematch` on the first import, a save of `set` made before it (what it names, and the decisions
 * stored after), a confirm carrying the same (refused, naming the same, nothing imported); then on the second import
 * `set` saved first and `rematch` after (the decisions stored after the match).
 */
const scenario = Effect.fn("scenario")(function* (input: {
  readonly rematch: ReadonlyArray<{ readonly field: Field; readonly column: number }>
  readonly set: Readonly<Record<string, RowDecisionFlags.Encoded>>
  /** What else is stored for the import saved on, before anything is decided. */
  readonly before: O.Option<(id: string) => Effect.Effect<void, never, SqlClient.SqlClient>>
}) {
  const { client, saving, matching } = yield* seeded
  yield* O.match(input.before, { onNone: () => Effect.void, onSome: (before) => before(saving.id) })
  const set = flags(input.set)
  const madeOn = R.map(set, () => saving.revision)
  const rematch = (id: typeof saving.id) =>
    Effect.forEach(
      input.rematch,
      (choice) =>
        client.imports
          .match({ params: { id }, payload: { field: choice.field, column: O.some(choice.column) } })
          .pipe(dana),
      { concurrency: 1 }
    )
  yield* rematch(saving.id)
  const saved = yield* client.imports
    .decide({ params: { id: saving.id }, payload: { over: {}, madeOn, set, clear: [] } })
    .pipe(marcus)
  const afterSave = yield* client.imports.get({ params: { id: saving.id } }).pipe(marcus)
  const refused = yield* Effect.flip(
    client.imports
      .commit({ params: { id: saving.id }, payload: { revision: afterSave.revision, madeOn, set, clear: [] } })
      .pipe(marcus)
  )
  const stillOpen = yield* client.imports.get({ params: { id: saving.id } }).pipe(marcus)
  const items = yield* client.items.list().pipe(marcus)

  yield* client.imports
    .decide({
      params: { id: matching.id },
      payload: { over: {}, madeOn: R.map(set, () => matching.revision), set, clear: [] }
    })
    .pipe(marcus)
  yield* rematch(matching.id)
  const afterMatch = yield* client.imports.get({ params: { id: matching.id } }).pipe(marcus)
  return {
    notApplied: saved.notApplied,
    saved: afterSave.decisions,
    refused: S.is(AcceptsTakenBack)(refused) ? refused.accepts : [],
    confirm: [stillOpen.status, stillOpen.revision === afterSave.revision, items.length],
    matched: afterMatch.decisions,
    matchedView: afterMatch
  }
})

const decided = (decisions: Readonly<Record<string, unknown>>, rows: ReadonlyArray<string>) =>
  A.map(rows, (row) => R.get(decisions, row))

/** What row 6's unit reads, and the fix it is offered, as the screen draws the import's review from this view. */
const unitOfRow6 = (view: ImportView) => {
  const drawn = review({
    table: reviewed,
    choices: view.choices,
    decisions: view.decisions,
    storedItems: view.storedItems,
    createdIds: view.createdIds,
    suggestions: view.suggestions,
    itemsOf: itemsOfRow
  })
  return O.map(
    A.findFirst(drawn.rows, (candidate) => candidate.id === "row-6"),
    (found) => ({
      reads: found.values.uom,
      fix: O.map(
        A.findFirst(found.proposals, (proposal) => proposal.field === "uom"),
        (proposal) => proposal.to
      )
    })
  )
}
/** The confirm wrote nothing: the import is open at the same revision, and only the two stocked items exist. */
const nothingWritten = ["open", true, 2]

layer(TypedApp)("a Replace or Keep-stored across a re-match of the SKU column", (it) => {
  it.effect("is named and not applied by a save, refuses a confirm, and is dropped by the match", () =>
    Effect.gen(function* () {
      const done = yield* scenario({
        before: O.none(),
        rematch: [{ field: "sku", column: column("Alt code") }],
        set: { "row-2": { stored: "replace" }, "row-3": { stored: "keep" } }
      })
      const named = [
        { rowId: "row-2", field: "sku", kind: "stored" },
        { rowId: "row-3", field: "sku", kind: "stored" }
      ]
      expect([done.notApplied, done.refused, done.confirm]).toEqual([named, named, nothingWritten])
      const undecided = [O.some(decisionFromFlags({})), O.some(decisionFromFlags({}))]
      expect(decided(done.saved, ["row-2", "row-3"])).toEqual(undecided)
      expect(decided(done.matched, ["row-2", "row-3"])).toEqual(undecided)
    })
  )
})

/** A name suggestion with no row, stored for the import `id`: the reader never shows such a row. */
const brokenSuggestion = Effect.fn("brokenSuggestion")(function* (id: string) {
  const sql = yield* SqlClient.SqlClient
  yield* sql`INSERT INTO importSuggestion (id, organizationId, importId, kind, rowId, rowNumber, field,
              fromValue, toValue, columnIndex, madeBy, model, confidence, basis, askedById, createdAt)
              VALUES ('00000000-0000-4000-8000-0000000000b1', 'org_prairie', ${id}, 'name', '', NULL, 'name', '', 'Crate', NULL, 'rule', NULL,
                'low', 'A row that was never whole.', 'mem_marcus', '2026-11-20T00:00:00.000Z')`
}, Effect.orDie)

layer(TypedApp)("a stored suggestion that never reads as one", (it) => {
  it.effect("does not make the import read as busy: the rule is judged and said as without it", () =>
    Effect.gen(function* () {
      // A name suggestion with no row: the reader never shows such a row, so the judgement never reads it, and the
      // guard on what the judgement read must not count it either.
      const done = yield* scenario({
        rematch: [{ field: "unitCost", column: column("List cost") }],
        set: { "row-2": { stored: "replace" }, "row-3": { stored: "replace" } },
        before: O.some(brokenSuggestion)
      })
      const named = [{ rowId: "row-3", field: "unitCost", kind: "stored" }]
      expect([done.notApplied, done.refused, done.confirm]).toEqual([named, named, nothingWritten])
    })
  )
})

layer(TypedApp)("a keep-one-of-two across a re-match of the SKU column", (it) => {
  it.effect("the row's place is open again, a row left out stays left out, at a save, a confirm and the match", () =>
    Effect.gen(function* () {
      const done = yield* scenario({
        before: O.none(),
        rematch: [{ field: "sku", column: column("Alt code") }],
        set: { "row-4": { kept: true }, "row-5": { out: true, kept: true } }
      })
      const named = [
        { rowId: "row-4", field: "sku", kind: "twin" },
        { rowId: "row-5", field: "sku", kind: "twin" }
      ]
      expect([done.notApplied, done.refused, done.confirm]).toEqual([named, named, nothingWritten])
      const after = [O.some(decisionFromFlags({})), O.some(decisionFromFlags({ out: true }))]
      expect(decided(done.saved, ["row-4", "row-5"])).toEqual(after)
      expect(decided(done.matched, ["row-4", "row-5"])).toEqual(after)
    })
  )
})

layer(TypedApp)("a Replace or Keep-stored across a re-match of another column", (it) => {
  it.effect("is taken back only where the row's comparison with its stored item changed; the other stands", () =>
    Effect.gen(function* () {
      const done = yield* scenario({
        before: O.none(),
        rematch: [{ field: "unitCost", column: column("List cost") }],
        set: { "row-2": { stored: "replace" }, "row-3": { stored: "replace" } }
      })
      const named = [{ rowId: "row-3", field: "unitCost", kind: "stored" }]
      expect([done.notApplied, done.refused, done.confirm]).toEqual([named, named, nothingWritten])
      const after = [O.some(decisionFromFlags({ stored: "replace" })), O.some(decisionFromFlags({}))]
      expect(decided(done.saved, ["row-2", "row-3"])).toEqual(after)
      expect(decided(done.matched, ["row-2", "row-3"])).toEqual(after)
    })
  )
})

layer(TypedApp)("a Replace judged after several re-matches of its column", (it) => {
  it.effect("is judged against the column the field read on the row's revision, kept in the draft's moves", () =>
    Effect.gen(function* () {
      const { client, saving } = yield* seeded
      const params = { id: saving.id }
      const match = (heading: Heading) =>
        client.imports.match({ params, payload: { field: "unitCost", column: O.some(column(heading)) } }).pipe(dana)
      const once = yield* match("List cost")
      yield* match("Net cost")
      const replace = flags({ "row-3": { stored: "replace" } })
      // Made while the cost read "unit_cost" (9.00, as "Net cost" reads): the comparison is the same, it stands.
      const before = yield* client.imports
        .decide({ params, payload: { over: {}, madeOn: { "row-3": saving.revision }, set: replace, clear: [] } })
        .pipe(marcus)
      // Made while it read "List cost" (3, the stored cost): the comparison changed, it is taken back.
      const between = yield* client.imports
        .decide({ params, payload: { over: {}, madeOn: { "row-3": once.revision }, set: replace, clear: [] } })
        .pipe(marcus)
      expect([before.notApplied, between.notApplied]).toEqual([
        [],
        [{ rowId: "row-3", field: "unitCost", kind: "stored" }]
      ])
    })
  )
})

layer(TypedApp)("an undone fix across a re-match of its field's column", (it) => {
  it.effect(
    "is named and not applied by a save, refuses a confirm, and is dropped by the match; the row shows the new value's fix",
    () =>
      Effect.gen(function* () {
        // The unit is matched to "Pack unit", where row 6 says "kg": a new value, with its own fix (KG).
        const done = yield* scenario({
          before: O.none(),
          rematch: [{ field: "uom", column: column("Pack unit") }],
          set: { "row-6": { reverted: ["uom"], edits: { name: "Hemp Rope 10m" } } }
        })
        const named = [{ rowId: "row-6", field: "uom", kind: "undo" }]
        expect([done.notApplied, done.refused, done.confirm]).toEqual([named, named, nothingWritten])
        const after = [O.some(decisionFromFlags({ edits: { name: "Hemp Rope 10m" } }))]
        expect(decided(done.saved, ["row-6"])).toEqual(after)
        expect(decided(done.matched, ["row-6"])).toEqual(after)
        // The fix the person undid was for "each"; the row now reads "kg", and its own fix is in force.
        expect(unitOfRow6(done.matchedView)).toEqual(O.some({ reads: "KG", fix: O.some("KG") }))
        expect(
          A.map(done.matchedView.takenBack, (entry) => [entry.field, entry.kind, entry.count, entry.rows])
        ).toEqual([["uom", "undo", 1, ["row-6"]]])
      })
  )
})

layer(TypedApp)("a field moved off its column when a person gives that column to another field", (it) => {
  it.effect("its accepts and undone fixes made before are named, refuse a confirm, and are dropped by the match", () =>
    Effect.gen(function* () {
      // Name takes the column headed "uom": the unit moves to its next heading match, none here.
      const done = yield* scenario({
        before: O.none(),
        rematch: [{ field: "name", column: column("uom") }],
        set: { "row-6": { reverted: ["uom"] }, "row-2": { accepted: ["uom"] } }
      })
      const named = [
        { rowId: "row-6", field: "uom", kind: "undo" },
        { rowId: "row-2", field: "uom", kind: "accept" }
      ]
      expect([done.notApplied, done.refused, done.confirm]).toEqual([named, named, nothingWritten])
      const after = [O.some(decisionFromFlags({})), O.some(decisionFromFlags({}))]
      expect(decided(done.saved, ["row-6", "row-2"])).toEqual(after)
      expect(decided(done.matched, ["row-6", "row-2"])).toEqual(after)
    })
  )
})

layer(TypedApp)("what a match took back from the stored decisions", (it) => {
  it.effect(
    "is kept by field and kind, named in every view, counted in the audit line, and let go at the confirm",
    () =>
      Effect.gen(function* () {
        const { client, matching } = yield* seeded
        const params = { id: matching.id }
        const set = flags({
          "row-3": { stored: "replace" },
          "row-2": { stored: "keep" },
          "row-4": { kept: true },
          "row-5": { out: true, kept: true },
          "row-6": { edits: { name: "Hemp Rope 10m" } }
        })
        const decided = yield* client.imports
          .decide({ params, payload: { over: {}, madeOn: R.map(set, () => matching.revision), set, clear: [] } })
          .pipe(marcus)
        const matched = yield* client.imports
          .match({ params, payload: { field: "sku", column: O.some(column("Alt code")) } })
          .pipe(dana)
        // Which decision each part was taken from: Marcus's save, at the revision it moved the draft to.
        const at = decided.revision
        const by = {
          revision: matched.revision,
          by: "Dana Whitfield",
          field: "sku",
          matched: O.some("sku"),
          reads: O.some(true)
        }
        const named = [
          { ...by, kind: "stored", count: 2, rows: ["row-2", "row-3"], saved: O.some({ "row-2": at, "row-3": at }) },
          { ...by, kind: "twin", count: 2, rows: ["row-4", "row-5"], saved: O.some({ "row-4": at, "row-5": at }) }
        ]
        expect(matched.takenBack).toEqual(named)
        const read = yield* client.imports.get({ params }).pipe(marcus)
        expect(read.takenBack).toEqual(named)
        const trail = yield* client.activity.recent().pipe(marcus)
        const lineOption = A.findFirst(trail, (entry) => entry.action === "Matched a column")
        assertTrue(O.isSome(lineOption), "expected line to be present")
        const line = lineOption.value
        expect(line.detail).toBe(
          `SKU reads column H "Alt code" in reviewed.csv; took back 2 Replaces or Keep-storeds, 2 keeps of one of two`
        )
        const confirmed = yield* client.imports
          .commit({ params, payload: { revision: matched.revision, madeOn: {}, set: {}, clear: [] } })
          .pipe(marcus)
        expect(confirmed.takenBack).toEqual([])
        const reopened = yield* client.imports.reopen({ params }).pipe(marcus)
        expect([reopened.status, reopened.takenBack]).toEqual(["open", []])
      })
  )
})

layer(TypedApp)("a Replace whose row stops reading under the column its field is matched to", (it) => {
  it.effect("is taken back by the match, though no difference of that field changed", () =>
    Effect.gen(function* () {
      const { client } = yield* seeded
      // Row 2 differs from its stored item on the name only; its cost reads 3 as stored, "Net cost" says "call".
      const reads = tableOf("reads.csv", [
        { ...item, sku: "AAA-0002", name: "Steel Bolt XL", unit_cost: "3", "Net cost": "call" }
      ])
      const view = yield* upload({ client, table: reads }).pipe(marcus)
      const params = { id: view.id }
      yield* client.imports
        .decide({
          params,
          payload: {
            over: {},
            madeOn: { "row-2": view.revision },
            set: flags({ "row-2": { stored: "replace" } }),
            clear: []
          }
        })
        .pipe(marcus)
      const matched = yield* client.imports
        .match({ params, payload: { field: "unitCost", column: O.some(column("Net cost")) } })
        .pipe(dana)
      expect(R.get(matched.decisions, "row-2")).toEqual(O.some(decisionFromFlags({})))
      expect(A.map(matched.takenBack, (entry) => [entry.field, entry.kind, entry.rows])).toEqual([
        ["unitCost", "stored", ["row-2"]]
      ])
    })
  )
})

layer(TypedApp)("a Replace whose row one match stops reading under two fields at once", (it) => {
  it.effect(
    "is taken back by the match and by a save made before it, and the entry says what was matched and reads",
    () =>
      Effect.gen(function* () {
        const { client } = yield* seeded
        const displaced = tableOf("displaced.csv", [
          { ...item, sku: "AAA-0002", name: "Steel Bolt XL", uom: "EA", unit_cost: "4.58" }
        ])
        const view = yield* upload({ client, table: displaced }).pipe(marcus)
        const params = { id: view.id }
        const replace = flags({ "row-2": { stored: "replace" } })
        const save = client.imports
          .decide({ params, payload: { over: {}, madeOn: { "row-2": view.revision }, set: replace, clear: [] } })
          .pipe(marcus)
        yield* save
        // The quantity is pointed at the cost's column: "4.58" is no count, and the cost reads no column.
        const matched = yield* client.imports
          .match({ params, payload: { field: "quantityOnHand", column: O.some(column("unit_cost")) } })
          .pipe(dana)
        expect(R.get(matched.decisions, "row-2")).toEqual(O.some(decisionFromFlags({})))
        expect(
          A.map(matched.takenBack, (entry) => [entry.field, entry.matched, entry.reads, entry.kind, entry.rows])
        ).toEqual([["unitCost", O.some("quantityOnHand"), O.some(false), "stored", ["row-2"]]])
        const again = yield* save
        expect(again.notApplied).toEqual([{ rowId: "row-2", field: "unitCost", kind: "stored" }])
      })
  )
})

layer(TypedApp)("a take-back stored before what was matched and whether it reads were kept", (it) => {
  it.effect("is still named, beside one that says both", () =>
    Effect.gen(function* () {
      const { client, matching } = yield* seeded
      const sql = yield* SqlClient.SqlClient
      const params = { id: matching.id }
      yield* sql`UPDATE importDraft SET takenBackJson = json_array(json_object('revision', 1, 'by', 'Dana Whitfield',
        'field', 'uom', 'kind', 'accept', 'count', 1, 'rows', json_array('row-4'))) WHERE id = ${matching.id}`
      yield* client.imports
        .decide({
          params,
          payload: {
            over: {},
            madeOn: { "row-6": matching.revision },
            set: flags({ "row-6": { reverted: ["uom"] } }),
            clear: []
          }
        })
        .pipe(marcus)
      const cleared = yield* client.imports.match({ params, payload: { field: "uom", column: O.none() } }).pipe(dana)
      expect(A.map(cleared.takenBack, (entry) => [entry.rows, entry.matched, entry.reads])).toEqual([
        [["row-4"], O.none(), O.none()],
        [["row-6"], O.some("uom"), O.some(false)]
      ])
    })
  )
})

layer(TypedApp)("a field matched by hand to the column it already reads", (it) => {
  it.effect(
    "takes nothing back, whatever the kind: at the match, at a save and at a confirm of what was made before",
    () =>
      Effect.gen(function* () {
        const { client, saving, matching } = yield* seeded
        const set = flags({
          "row-2": { stored: "replace", accepted: ["unitCost"] },
          "row-3": { stored: "keep" },
          "row-4": { kept: true },
          "row-5": { out: true },
          "row-6": { reverted: ["uom"] }
        })
        const rows = R.keys(set)
        const asMade = A.map(rows, (row) => R.get(set, row))
        // The SKU, the cost and the unit are read by their headings: Dana picks the very same columns by hand.
        const picked = (id: typeof saving.id) =>
          Effect.forEach(
            [
              { field: "sku" as const, column: column("sku") },
              { field: "unitCost" as const, column: column("unit_cost") },
              { field: "uom" as const, column: column("uom") }
            ],
            (pick) =>
              client.imports
                .match({ params: { id }, payload: { field: pick.field, column: O.some(pick.column) } })
                .pipe(dana),
            { concurrency: 1 }
          )
        yield* client.imports
          .decide({
            params: { id: matching.id },
            payload: { over: {}, madeOn: R.map(set, () => matching.revision), set, clear: [] }
          })
          .pipe(marcus)
        yield* picked(matching.id)
        const matched = yield* client.imports.get({ params: { id: matching.id } }).pipe(marcus)
        expect([decided(matched.decisions, rows), matched.takenBack]).toEqual([asMade, []])
        const trail = yield* client.activity.recent().pipe(marcus)
        expect(
          A.sort(
            A.map(
              A.filter(trail, (entry) => entry.action === "Matched a column"),
              (entry) => entry.detail
            ),
            Order.String
          )
        ).toEqual([
          `SKU reads column A "sku" in reviewed.csv`,
          `Unit cost reads column F "unit_cost" in reviewed.csv`,
          `Unit of measure reads column E "uom" in reviewed.csv`
        ])

        const params = { id: saving.id }
        const madeOn = R.map(set, () => saving.revision)
        yield* picked(saving.id)
        const saved = yield* client.imports
          .decide({ params, payload: { over: {}, madeOn, set, clear: [] } })
          .pipe(marcus)
        expect(saved.notApplied).toEqual([])
        const after = yield* client.imports.get({ params }).pipe(marcus)
        expect(decided(after.decisions, rows)).toEqual(asMade)
        const confirmed = yield* client.imports
          .commit({ params, payload: { revision: after.revision, madeOn, set, clear: [] } })
          .pipe(marcus)
        expect(confirmed.status).toBe("imported")
      })
  )
})

layer(TypedApp)("a field matched to another column and back to the one it read", (it) => {
  it.effect(
    "moved twice: a decision of each kind made before both picks is named, refuses a confirm, and is dropped",
    () =>
      Effect.gen(function* () {
        const done = yield* scenario({
          before: O.none(),
          rematch: [
            { field: "sku", column: column("Alt code") },
            { field: "sku", column: column("sku") },
            { field: "uom", column: column("Pack unit") },
            { field: "uom", column: column("uom") }
          ],
          set: {
            "row-2": { stored: "replace", accepted: ["uom"] },
            "row-3": { stored: "keep" },
            "row-4": { kept: true },
            "row-6": { reverted: ["uom"] }
          }
        })
        const named = [
          { rowId: "row-2", field: "uom", kind: "accept" },
          { rowId: "row-2", field: "sku", kind: "stored" },
          { rowId: "row-3", field: "sku", kind: "stored" },
          { rowId: "row-4", field: "sku", kind: "twin" },
          { rowId: "row-6", field: "uom", kind: "undo" }
        ]
        expect([done.notApplied, done.refused, done.confirm]).toEqual([named, named, nothingWritten])
        expect(decided(done.matched, ["row-2", "row-3", "row-4", "row-6"])).toEqual(
          A.replicate(O.some(decisionFromFlags({})), 4)
        )
      })
  )
})

/** The import as a match of its cost to "List cost" left it before moves were kept: a choice, and no move. */
const matchedLongAgo = Effect.fn("matchedLongAgo")(function* (id: string) {
  const sql = yield* SqlClient.SqlClient
  yield* sql`UPDATE importDraft SET revision = revision + 1, movesJson = '[]',
      choicesJson = json_array(json_object('field', 'unitCost', 'column', ${column("List cost")}, 'by', 'person',
        'at', revision + 1))
    WHERE id = ${id}`
}, Effect.orDie)

layer(TypedApp)("a Replace or Keep-stored on an import matched before moves were kept", (it) => {
  it.effect("is named by a save, refuses a confirm, and is dropped by a further match and named in the view", () =>
    Effect.gen(function* () {
      const { client, saving, matching } = yield* seeded
      // Row 2's cost reads 99.00 in every cost column: only not knowing which one it read takes its Replace back.
      const set = flags({ "row-2": { stored: "replace" }, "row-3": { stored: "keep" } })
      const named = [
        { rowId: "row-2", field: "unitCost", kind: "stored" },
        { rowId: "row-3", field: "unitCost", kind: "stored" }
      ]
      const undecided = A.replicate(O.some(decisionFromFlags({})), 2)
      const params = { id: saving.id }
      const madeOn = R.map(set, () => saving.revision)
      yield* matchedLongAgo(saving.id)
      // The column it reads since, picked again: an old choice with no moves is not a pick of the same column.
      yield* client.imports
        .match({ params, payload: { field: "unitCost", column: O.some(column("List cost")) } })
        .pipe(dana)
      const saved = yield* client.imports.decide({ params, payload: { over: {}, madeOn, set, clear: [] } }).pipe(marcus)
      expect(saved.notApplied).toEqual(named)
      const refused = yield* Effect.flip(
        client.imports.commit({ params, payload: { revision: saved.revision, madeOn, set, clear: [] } }).pipe(marcus)
      )
      expect(S.is(AcceptsTakenBack)(refused) ? refused.accepts : refused).toEqual(named)

      const other = { id: matching.id }
      yield* client.imports
        .decide({ params: other, payload: { over: {}, madeOn: R.map(set, () => matching.revision), set, clear: [] } })
        .pipe(marcus)
      yield* matchedLongAgo(matching.id)
      const further = yield* client.imports
        .match({ params: other, payload: { field: "unitCost", column: O.some(column("Net cost")) } })
        .pipe(dana)
      expect(decided(further.decisions, ["row-2", "row-3"])).toEqual(undecided)
      expect(A.map(further.takenBack, (entry) => [entry.field, entry.kind, entry.rows])).toEqual([
        ["unitCost", "stored", ["row-2", "row-3"]]
      ])
      // One made after that match and stored is taken back by the next one too, though row 2 compares the same under
      // every cost column, and the entry names it.
      const third = yield* upload({ client, table: reviewed }).pipe(marcus)
      yield* matchedLongAgo(third.id)
      const since = yield* client.imports.get({ params: { id: third.id } }).pipe(marcus)
      const kept = yield* client.imports
        .decide({
          params: { id: third.id },
          payload: {
            over: {},
            madeOn: { "row-2": since.revision },
            set: flags({ "row-2": { stored: "replace" } }),
            clear: []
          }
        })
        .pipe(marcus)
      expect(kept.notApplied).toEqual([])
      const after = yield* client.imports
        .match({ params: { id: third.id }, payload: { field: "unitCost", column: O.some(column("Net cost")) } })
        .pipe(dana)
      expect([
        R.get(after.decisions, "row-2"),
        A.map(after.takenBack, (entry) => [entry.field, entry.kind, entry.rows])
      ]).toEqual([O.some(decisionFromFlags({})), [["unitCost", "stored", ["row-2"]]]])
      // Made before the match that kept no move: still not known, though the further match kept its own.
      const late = yield* client.imports
        .decide({ params: other, payload: { over: {}, madeOn: R.map(set, () => matching.revision), set, clear: [] } })
        .pipe(marcus)
      expect(late.notApplied).toEqual(named)
    })
  )
})

layer(TypedApp)("a Replace made after a match before moves were kept, and stored (Leave as made)", (it) => {
  it.effect("stands through a match of another field, and a confirm imports it as made, not judged again", () =>
    Effect.gen(function* () {
      const { client, matching } = yield* seeded
      const params = { id: matching.id }
      yield* matchedLongAgo(matching.id)
      const long = yield* client.imports.get({ params }).pipe(marcus)
      yield* client.imports
        .decide({
          params,
          payload: {
            over: {},
            madeOn: { "row-2": long.revision },
            set: flags({ "row-2": { stored: "replace" } }),
            clear: []
          }
        })
        .pipe(marcus)
      // Description moves to "Pack unit", empty on row 2 as its own column is: the cost was not matched again.
      const other = yield* client.imports
        .match({ params, payload: { field: "description", column: O.some(column("Pack unit")) } })
        .pipe(dana)
      expect([R.get(other.decisions, "row-2"), other.takenBack]).toEqual([
        O.some(decisionFromFlags({ stored: "replace" })),
        []
      ])
      // The confirm carries nothing of its own: the stored Replace is imported as made.
      const confirmed = yield* client.imports
        .commit({ params, payload: { revision: other.revision, madeOn: {}, set: {}, clear: [] } })
        .pipe(marcus)
      const resultOption = confirmed.result
      assertTrue(O.isSome(resultOption), "expected result to be present")
      const result = resultOption.value
      const items = yield* client.items.list().pipe(marcus)
      const replaced = A.findFirst(items, (one) => one.sku === "AAA-0001")
      expect([result.updated, O.map(replaced, (one) => one.revision)]).toEqual([1, O.some(2)])
    })
  )
})
