// What a re-match of a column takes back besides accepts (Benjamin, 2026-11-20: "Server refuses, says so" for a SKU
// re-match and an undone fix, "Refuse if it changes the row" for a Replace across another re-match), and a field moved
// off its column by another field's match, on the real handlers and SQL, a fresh D1 for each rule. Each rule at a save
// (named in `notApplied`), at a confirm (refused whole, nothing imported) and at the match itself (a stored decision
// dropped in the match's own batch). The same scenarios run over the twins in the catalog model's StaleDecisions test.
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as HttpApiTest from "effect/http-api/HttpApiTest"
import { decisionFromFlags, type RowDecisionFlags } from "@inventory/catalog-contract/Decision"
import { AcceptsTakenBack } from "@inventory/catalog-contract/ImportRejection"
import type { Field, StagedTable } from "@inventory/catalog-contract/Staged"
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
  "Net cost"
] as const
type Heading = (typeof headings)[number]
type Line = Partial<Record<Heading, string>>
const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
const column = (heading: Heading): number =>
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
  { ...item, sku: "CCC-0001", name: "Hemp Rope", uom: "each", unit_cost: "4", "Alt code": "XXX-0001" }
])

const marcus = as("mem_marcus")
const dana = as("mem_dana")

/** The two items stocked, then the reviewed file staged twice: one import to save and confirm on, one to match on. */
const seeded = Effect.gen(function* () {
  const client = yield* HttpApiTest.groups(Api, ["imports", "items"])
  const first = yield* upload({ client, table: stocked }).pipe(marcus)
  yield* client.imports
    .commit({ params: { id: first.id }, payload: { revision: first.revision, madeOn: {}, set: {}, clear: [] } })
    .pipe(marcus)
  const saving = yield* upload({ client, table: reviewed }).pipe(marcus)
  const matching = yield* upload({ client, table: reviewed }).pipe(marcus)
  return { client, saving, matching }
})

const flags = (set: Readonly<Record<string, RowDecisionFlags>>) => R.map(set, decisionFromFlags)

/**
 * One rule end to end: `rematch` on the first import, a save of `set` made before it (what it names, and the decisions
 * stored after), a confirm carrying the same (refused, naming the same, nothing imported); then on the second import
 * `set` saved first and `rematch` after (the decisions stored after the match).
 */
const scenario = Effect.fn("scenario")(function* (input: {
  readonly rematch: ReadonlyArray<{ readonly field: Field; readonly column: number }>
  readonly set: Readonly<Record<string, RowDecisionFlags>>
}) {
  const { client, saving, matching } = yield* seeded
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
    .decide({ params: { id: saving.id }, payload: { madeOn, set, clear: [] } })
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
    .decide({ params: { id: matching.id }, payload: { madeOn: R.map(set, () => matching.revision), set, clear: [] } })
    .pipe(marcus)
  yield* rematch(matching.id)
  const afterMatch = yield* client.imports.get({ params: { id: matching.id } }).pipe(marcus)
  return {
    notApplied: saved.notApplied,
    saved: afterSave.decisions,
    refused: S.is(AcceptsTakenBack)(refused) ? refused.accepts : [],
    confirm: [stillOpen.status, stillOpen.revision === afterSave.revision, items.length],
    matched: afterMatch.decisions
  }
})

const decided = (decisions: Readonly<Record<string, unknown>>, rows: ReadonlyArray<string>) =>
  A.map(rows, (row) => R.get(decisions, row))
/** The confirm wrote nothing: the import is open at the same revision, and only the two stocked items exist. */
const nothingWritten = ["open", true, 2]

layer(TypedApp)("a Replace or Keep-stored across a re-match of the SKU column", (it) => {
  it.effect("is named and not applied by a save, refuses a confirm, and is dropped by the match", () =>
    Effect.gen(function* () {
      const done = yield* scenario({
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

layer(TypedApp)("a keep-one-of-two across a re-match of the SKU column", (it) => {
  it.effect("the row's place is open again, a row left out stays left out, at a save, a confirm and the match", () =>
    Effect.gen(function* () {
      const done = yield* scenario({
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
        .decide({ params, payload: { madeOn: { "row-3": saving.revision }, set: replace, clear: [] } })
        .pipe(marcus)
      // Made while it read "List cost" (3, the stored cost): the comparison changed, it is taken back.
      const between = yield* client.imports
        .decide({ params, payload: { madeOn: { "row-3": once.revision }, set: replace, clear: [] } })
        .pipe(marcus)
      expect([before.notApplied, between.notApplied]).toEqual([
        [],
        [{ rowId: "row-3", field: "unitCost", kind: "stored" }]
      ])
    })
  )
})

layer(TypedApp)("an undone fix across a re-match of its field's column", (it) => {
  it.effect("is named and not applied by a save, refuses a confirm, and is dropped by the match", () =>
    Effect.gen(function* () {
      const done = yield* scenario({
        rematch: [{ field: "uom", column: column("uom") }],
        set: { "row-6": { reverted: ["uom"], edits: { name: "Hemp Rope 10m" } } }
      })
      const named = [{ rowId: "row-6", field: "uom", kind: "undo" }]
      expect([done.notApplied, done.refused, done.confirm]).toEqual([named, named, nothingWritten])
      const after = [O.some(decisionFromFlags({ edits: { name: "Hemp Rope 10m" } }))]
      expect(decided(done.saved, ["row-6"])).toEqual(after)
      expect(decided(done.matched, ["row-6"])).toEqual(after)
    })
  )
})

layer(TypedApp)("a field moved off its column when a person gives that column to another field", (it) => {
  it.effect("its accepts and undone fixes made before are named, refuse a confirm, and are dropped by the match", () =>
    Effect.gen(function* () {
      // Name takes the column headed "uom": the unit moves to its next heading match, none here.
      const done = yield* scenario({
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
