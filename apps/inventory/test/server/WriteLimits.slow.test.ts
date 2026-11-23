// D1 binds at most 100 values to a statement, and a file may have 50,000 rows (`maxStagedRows`). A save, a match and a
// confirm check, inside their own batch, everything the judgement of a Replace across a re-match read: every SKU of the
// file, every item stored under them, the import's created rows and its suggestions. None of them may stop working
// because the file is large: each is done here at that size, on the real SQL and a fresh D1. The rows are written by
// SQL, so the tests spend their time on the statements they are about.
import { D1, type Pending } from "@beep/d1/D1"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import * as HttpApiTest from "effect/http-api/HttpApiTest"
import * as SqlClient from "effect/sql/SqlClient"
import { decisionFromFlags, type RowDecision } from "@inventory/catalog-contract/Decision"
import { ConfirmId, ImportId, ItemId } from "@inventory/catalog-contract/Ids"
import { ColumnMove, MappingChoice } from "@inventory/catalog-contract/Mapping"
import { maxStagedRows, StagedHead } from "@inventory/catalog-contract/Staged"
import { ImportStoreD1 } from "@inventory/catalog-host/ImportStoreD1"
import { ConfirmPlan } from "@inventory/catalog-model/Confirm"
import { ConfirmWrite, ImportStore } from "@inventory/catalog-model/ImportStore"
import { ItemsAsRead, noItemsRead } from "@inventory/catalog-model/Rematch"
import { Activity } from "@inventory/kernel/Activity"
import { ActivityId, MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { Api } from "../../src/api/v1/Api.ts"
import { as, testAppAround } from "./support/app.ts"

/** The most values a statement of a save, a match or a confirm binds (the store's own arithmetic, beside its lists). */
const mostBound = 31
/** D1's limit on one bound text, in bytes of UTF-8, which the local D1 does not hold a statement to. */
const longestBound = 2_000_000
const encoder = new TextEncoder()
const bytesOf = (value: unknown): number => (P.isString(value) ? encoder.encode(value).length : 0)

// D1 as it is, refusing a batch with a statement that binds more than the store says any does, whatever the file, or a
// text of more bytes than D1 takes.
const CountedD1 = Layer.effect(
  D1,
  Effect.gen(function* () {
    const d1 = yield* D1
    const counted = <A, E, R>(query: Pending<A, E, R>): Pending<A, E, R> =>
      Effect.tap(query, (built) => {
        const [text, values] = built.statement.compile()
        const longest = A.reduce(values, 0, (most, value) => Math.max(most, bytesOf(value)))
        return values.length > mostBound || longest > longestBound
          ? Effect.die(`${values.length} values bound, the longest ${longest} bytes, by: ${text}`)
          : Effect.void
      })
    // Each statement counted as it is built; the tuple's types are those of the statements as given.
    const batch: D1["Service"]["batch"] = <const Queries extends ReadonlyArray<Pending<unknown, unknown, unknown>>>(
      queries: Queries
    ) => d1.batch(A.map(queries, counted) as unknown as Queries)
    return D1.of({ run: d1.run, batch })
  })
)
const App = testAppAround(ImportStoreD1.pipe(Layer.fresh, Layer.provide(CountedD1)))

const org = OrganizationId.make("org_prairie")
const at = "2026-11-21T00:00:00.000Z"
const marcus = Member.make({
  id: MemberId.make("mem_marcus"),
  name: "Marcus Oyelaran",
  role: "editor",
  organizationId: org,
  organizationName: "Example Works (test)"
})

const labels = ["sku", "name", "category", "uom", "unit_cost", "quantity_on_hand", "List cost"]
const letters = ["A", "B", "C", "D", "E", "F", "G"]
const unitCost = 4
const listCost = 6
const head: StagedHead = {
  fileName: "large.csv",
  kind: "csv",
  sheet: O.none(),
  headerRowNumber: 1,
  columns: A.map(labels, (label, index) => ({ index, letter: O.getOrElse(A.get(letters, index), () => "A"), label })),
  notes: []
}
const choices: ReadonlyArray<MappingChoice> = [{ field: "unitCost", column: listCost, by: "person", at: 1 }]
const moves: ReadonlyArray<ColumnMove> = [{ field: "unitCost", at: 1, was: unitCost, column: listCost }]
const Stored = S.Struct({
  head: S.fromJsonString(StagedHead),
  choices: MappingChoice.pipe(S.Array, S.fromJsonString),
  moves: ColumnMove.pipe(S.Array, S.fromJsonString)
})

/** The id the seeding gives the nth item, and the SKU of the nth row of the file. */
const itemId = (n: number): ItemId => ItemId.make(`00000000-0000-4000-8000-${Str.padStart(12, "0")(`${n}`)}`)
const prefixes = ["AAA", "AAB", "AAC", "AAD", "AAE"]
const sku = (n: number): string =>
  `${O.getOrElse(A.get(prefixes, Math.floor(n / 10_000)), () => "ZZZ")}-${Str.padStart(4, "0")(`${n % 10_000}`)}`
const counted = <A>(n: number, each: (index: number) => A): ReadonlyArray<A> => (n === 0 ? [] : A.makeBy(n, each))

/**
 * A file of 50,000 rows staged as `id` (row 2 is `AAA-0000`), its unit cost matched by hand to "List cost" at
 * revision 1 (each row reads the same cost there), and the first `stored` of its SKUs in the organization already.
 */
const seeded = Effect.fn("seeded")(function* (id: ImportId, stored: number) {
  const sql = yield* SqlClient.SqlClient
  const json = yield* S.encodeEffect(Stored)({ head, choices, moves })
  yield* sql`INSERT INTO importDraft (id, organizationId, actorId, actorName, fileName, headJson, rowCount, status,
      createdAt, revision, choicesJson, movesJson)
    VALUES (${id}, ${org}, 'mem_marcus', 'Marcus Oyelaran', 'large.csv', ${json.head}, ${maxStagedRows}, 'open', ${at},
      1, ${json.choices}, ${json.moves})`
  yield* sql`WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i + 1 < ${maxStagedRows})
    INSERT INTO importChunk (organizationId, importId, seq, rowsJson)
    SELECT ${org}, ${id}, i / 500, json_group_array(json_object('rowNumber', i + 2, 'cells', json_array(
      json_object('text', 'AA' || char(65 + i / 10000) || printf('-%04d', i % 10000)),
      json_object('text', 'Oak Crate'), json_object('text', 'packaging'),
      json_object('text', 'EA'), json_object('text', '2'), json_object('text', '10'), json_object('text', '2'))))
    FROM n GROUP BY i / 500`
  // The import the stored items came from, and its confirm.
  const from = `${Str.slice(0, 35)(id)}f`
  yield* sql`INSERT INTO importDraft (id, organizationId, actorId, actorName, fileName, headJson, rowCount, status,
      createdAt)
    VALUES (${from}, ${org}, 'mem_marcus', 'Marcus Oyelaran', 'stocked.csv', ${json.head}, 0, 'imported', ${at})`
  yield* sql`INSERT INTO importBatch (id, organizationId, importId, confirmedById, confirmedByName, confirmedAt)
    VALUES (${from}, ${org}, ${from}, 'mem_marcus', 'Marcus Oyelaran', ${at})`
  yield* sql`WITH RECURSIVE n(i) AS (SELECT 0 WHERE ${stored} > 0 UNION ALL SELECT i + 1 FROM n WHERE i + 1 < ${stored})
    INSERT INTO item (id, organizationId, sku, skuKey, name, category, uom, unitCost, quantityOnHand, importId, batchId,
      sourceRow, createdById, createdBy, createdAt)
    SELECT printf('00000000-0000-4000-8000-%012d', i), ${org}, 'AA' || char(65 + i / 10000) || printf('-%04d', i % 10000),
      'AA' || char(65 + i / 10000) || printf('-%04d', i % 10000),
      'Oak Crate', 'packaging', 'EA', '1', 10, ${from}, ${from}, i + 2, 'mem_marcus', 'Marcus Oyelaran', ${at} FROM n`
})

/** How many of the import's decisions are stored, and how many pieces of a write's lists are left behind. */
const savedFor = Effect.fn("savedFor")(function* (id: ImportId) {
  const sql = yield* SqlClient.SqlClient
  const found = yield* sql<{ readonly n: number; readonly left: number }>`SELECT COUNT(*) AS n,
      (SELECT COUNT(*) FROM importWriteList) AS left FROM importDecision WHERE importId = ${id}`
  return A.map(found, (row) => [row.n, row.left])
})

const replace = decisionFromFlags({ stored: "replace" })
const out = decisionFromFlags({ out: true })

/** What a judgement of the whole file read: each row's SKU, one stored item, and three created items a row. */
const everything = ItemsAsRead.make({
  asked: true,
  keys: counted(maxStagedRows, sku),
  items: [{ id: itemId(0), revision: 1 }],
  created: A.flatMap(
    counted(maxStagedRows, (n) => n + 2),
    (rowNumber) => A.map([1, 2, 3], (part) => ({ rowNumber, part }))
  ),
  suggestions: []
})

/** What `everything` says is there: an import confirmed before and reopened, whose every row held three items. */
const createdBefore = Effect.fn("createdBefore")(function* (id: ImportId) {
  const sql = yield* SqlClient.SqlClient
  yield* sql`WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i + 1 < ${maxStagedRows}),
      p(part) AS (VALUES (1), (2), (3))
    INSERT INTO importOutcome (organizationId, importId, rowNumber, part, sku, name, outcome, reason)
    SELECT ${org}, ${id}, i + 2, part, 'AAA-0000', 'Oak Crate', 'created', '' FROM n, p`
})

layer(App)("a save of every row of a file of 50,000", (it) => {
  it.effect(
    "carrying a Replace made before its cost was matched again, with 12,000 of the file's SKUs stored: every row is saved",
    () =>
      Effect.gen(function* () {
        const id = ImportId.make("00000000-0000-4000-8000-0000000000a0")
        yield* seeded(id, 12_000)
        const client = yield* HttpApiTest.groups(Api, ["imports"])
        const set: Readonly<Record<string, RowDecision>> = R.fromEntries(
          counted(maxStagedRows, (n) => [`row-${n + 2}`, n === 0 ? replace : out] as const)
        )
        const saved = yield* client.imports
          .decide({ params: { id }, payload: { opening: 0, madeOn: R.map(set, () => 0), set, clear: [] } })
          .pipe(as("mem_marcus"))
        expect([saved.notApplied, saved.changed, saved.revision]).toEqual([[], true, 2])
        const held = yield* savedFor(id)
        expect(held).toEqual([[maxStagedRows, 0]])
      })
  )
})

layer(App)("the most rows one save may name", (it) => {
  it.effect("50,000 set and 50,000 cleared, with nothing judged: every row set is saved, one revision on", () =>
    Effect.gen(function* () {
      const id = ImportId.make("00000000-0000-4000-8000-0000000000d0")
      yield* seeded(id, 1)
      const store = yield* ImportStore
      const found = yield* store.find(org, id)
      const draft = O.getOrThrow(found)
      const set: Readonly<Record<string, RowDecision>> = R.fromEntries(
        counted(maxStagedRows, (n) => [`row-${n + 2}`, out] as const)
      )
      const clear = counted(maxStagedRows, (n) => `row-${n + 2 + maxStagedRows}`)
      const saved = yield* store.decide(marcus, draft, { set, clear })
      const held = yield* savedFor(id)
      expect([saved, held]).toEqual([{ kind: "saved", revision: 2, changed: true }, [[maxStagedRows, 0]]])
    })
  )
})

layer(App)("a save of long typed values", (it) => {
  it.effect("2,000 rows with 1,500 characters typed on each: more than one value may hold, and all are saved", () =>
    Effect.gen(function* () {
      const id = ImportId.make("00000000-0000-4000-8000-0000000000e0")
      yield* seeded(id, 1)
      const store = yield* ImportStore
      const found = yield* store.find(org, id)
      const typed = decisionFromFlags({ edits: { description: Str.repeat(1500)("x") } })
      const set: Readonly<Record<string, RowDecision>> = R.fromEntries(
        counted(2000, (n) => [`row-${n + 2}`, typed] as const)
      )
      const saved = yield* store.decide(marcus, O.getOrThrow(found), { set, clear: [] })
      const held = yield* savedFor(id)
      expect([saved.kind, held]).toEqual(["saved", [[2000, 0]]])
    })
  )
})

// Written as JSON inside JSON, a quote and a backslash are four bytes each; "é" is two and "木" three, as UTF-8.
const heavy: ReadonlyArray<readonly [string, string]> = [
  ["quotes", '"'],
  ["backslashes", "\\"],
  ["letters of three bytes", "木"],
  ["characters of four bytes", "📦"]
]

layer(App)("a save, a match and a confirm of long typed values whose bytes are more than their characters", (it) => {
  for (const [index, [name, text]] of A.map(heavy, (one, index) => [index, one] as const)) {
    it.effect(
      `2,000 rows with 1,500 ${name} typed on each: every piece fits, and all are saved, matched and confirmed`,
      () =>
        Effect.gen(function* () {
          const id = ImportId.make(`00000000-0000-4000-8000-0000000000${index + 1}1`)
          yield* seeded(id, index === 0 ? 1 : 0)
          const store = yield* ImportStore
          const at = yield* DateTime.now
          const draftNow = Effect.map(store.find(org, id), O.getOrThrow)
          // The unit accepted too, so a match of the unit rewrites every one of them.
          const typed = (by: string) =>
            decisionFromFlags({ accepted: ["uom"], edits: { description: Str.repeat(1500)(text), name: by } })
          const set = (by: string): Readonly<Record<string, RowDecision>> =>
            R.fromEntries(counted(2000, (n) => [`row-${n + 2}`, typed(by)] as const))
          const first = yield* draftNow
          const saved = yield* store.decide(marcus, first, { set: set("saved"), clear: [] })
          const second = yield* draftNow
          const matched = yield* store.matchColumn(marcus, second, { field: "uom", column: null }, "Unit of measure")
          const third = yield* draftNow
          const confirmed = yield* store.commit(
            ConfirmWrite.make({
              draft: id,
              fileName: "large.csv",
              confirm: ConfirmId.make(`00000000-0000-4000-8000-0000000000${index + 1}2`),
              expected: third.revision,
              unsaved: { set: set("confirmed"), clear: [] },
              plan: ConfirmPlan.make({ draft: id, rows: [] }),
              itemIds: [],
              read: noItemsRead,
              audit: Activity.make({
                id: ActivityId.make(`00000000-0000-4000-8000-0000000000${index + 1}3`),
                organizationId: org,
                actorId: marcus.id,
                actorName: marcus.name,
                action: "Imported items",
                detail: "",
                agent: O.none(),
                createdAt: at
              })
            })
          )
          const held = yield* savedFor(id)
          expect([saved.kind, matched, confirmed.kind, held]).toEqual(["saved", "saved", "confirmed", [[2000, 0]]])
        })
    )
  }
})

layer(App)("a save of 50,000 rows that waited", (it) => {
  it.effect("each named with what it may be written over: every row but the one decided since is written", () =>
    Effect.gen(function* () {
      const id = ImportId.make("00000000-0000-4000-8000-0000000000f0")
      yield* seeded(id, 1)
      const client = yield* HttpApiTest.groups(Api, ["imports"])
      const set: Readonly<Record<string, RowDecision>> = R.fromEntries(
        counted(maxStagedRows, (n) => [`row-${n + 2}`, n === 0 ? replace : out] as const)
      )
      const theirs = decisionFromFlags({ edits: { name: "Pine Crate" } })
      yield* client.imports
        .decide({
          params: { id },
          payload: { opening: 0, madeOn: { "row-9": 1 }, set: { "row-9": theirs }, clear: [] }
        })
        .pipe(as("mem_dana"))
      const saved = yield* client.imports
        .decide({
          params: { id },
          payload: {
            opening: 0,
            madeOn: R.map(set, () => 0),
            set,
            clear: [],
            over: R.map(set, () => [O.none(), O.some(replace)])
          }
        })
        .pipe(as("mem_marcus"))
      expect([saved.decidedSince, saved.changed, saved.revision]).toEqual([
        [{ rowId: "row-9", theirs: O.some(theirs) }],
        true,
        3
      ])
      const held = yield* savedFor(id)
      expect(held).toEqual([[maxStagedRows, 0]])
    })
  )
})

layer(App)("a save of 50,000 Replaces that waited across a match of their cost", (it) => {
  it.effect("each naming three decisions it may be written over: judged once, and every row written", () =>
    Effect.gen(function* () {
      const id = ImportId.make("00000000-0000-4000-8000-0000000000f1")
      yield* seeded(id, 12_000)
      const client = yield* HttpApiTest.groups(Api, ["imports"])
      // Every row's own Replace was made before the cost was matched again: the file's review is asked of each.
      const set: Readonly<Record<string, RowDecision>> = R.fromEntries(
        counted(maxStagedRows, (n) => [`row-${n + 2}`, replace] as const)
      )
      const keep = decisionFromFlags({ stored: "keep" })
      const saved = yield* client.imports
        .decide({
          params: { id },
          payload: {
            opening: 0,
            madeOn: R.map(set, () => 0),
            set,
            clear: [],
            over: R.map(set, () => [O.none(), O.some(replace), O.some(keep)])
          }
        })
        .pipe(as("mem_marcus"))
      expect([saved.decidedSince, saved.notApplied, saved.changed]).toEqual([[], [], true])
      const held = yield* savedFor(id)
      expect(held).toEqual([[maxStagedRows, 0]])
    })
  )
})

layer(App)("a confirm that writes every row of a file of 50,000", (it) => {
  it.effect(
    "items created and replaced, rows left out, values typed: each is stored, and counted as stored",
    () =>
      Effect.gen(function* () {
        const id = ImportId.make("00000000-0000-4000-8000-0000000000f5")
        const replaced = 1000
        const leftOut = 10_000
        yield* seeded(id, replaced)
        const client = yield* HttpApiTest.groups(Api, ["imports"])
        // The first rows replace their stored item, the last are left out, and every row typed on has a long description
        // whose bytes are more than its characters. A Replace was made before the cost was matched again: the confirm
        // reads and checks everything its judgement rests on too.
        const description = 'a "quoted" 木 word'
        const typed = decisionFromFlags({ edits: { description } })
        const replacing = decisionFromFlags({ stored: "replace", edits: { description } })
        const set: Readonly<Record<string, RowDecision>> = R.fromEntries(
          counted(
            maxStagedRows,
            (n) => [`row-${n + 2}`, n < replaced ? replacing : n >= maxStagedRows - leftOut ? out : typed] as const
          )
        )
        const confirmed = yield* client.imports
          .commit({ params: { id }, payload: { revision: 1, madeOn: R.map(set, () => 0), set, clear: [] } })
          .pipe(as("mem_marcus"))
        const result = O.getOrThrow(confirmed.result)
        const written = maxStagedRows - leftOut
        expect([result.created, result.updated, result.already, result.notImported]).toEqual([
          written - replaced,
          replaced,
          0,
          leftOut
        ])
        const sql = yield* SqlClient.SqlClient
        const stored = yield* sql<{
          readonly items: number
          readonly changes: number
          readonly outcomes: number
        }>`SELECT
        (SELECT COUNT(*) FROM item WHERE organizationId = ${org} AND description = ${description}) AS items,
        (SELECT COUNT(*) FROM importChange WHERE importId = ${id}) AS changes,
        (SELECT COUNT(*) FROM importOutcome WHERE importId = ${id}) AS outcomes`
        expect(stored).toEqual([{ items: written, changes: written, outcomes: maxStagedRows }])
        const held = yield* savedFor(id)
        expect(held).toEqual([[maxStagedRows, 0]])
      }),
    // The whole file is reviewed and written, and the slow suite runs beside it.
    120_000
  )
})

layer(App)("a match and a confirm of a file of 50,000 rows", (it) => {
  it.effect("the match checks everything its review read, however much that is, and is written", () =>
    Effect.gen(function* () {
      const id = ImportId.make("00000000-0000-4000-8000-0000000000b0")
      yield* seeded(id, 1)
      yield* createdBefore(id)
      const store = yield* ImportStore
      const found = yield* store.find(org, id)
      const draft = O.getOrThrow(found)
      yield* store.decide(marcus, draft, { set: { "row-2": replace }, clear: [] })
      const answer = yield* store.matchColumn(marcus, draft, { field: "unitCost", column: unitCost }, "Unit cost", () =>
        Effect.succeed({ changed: [], read: everything })
      )
      const after = yield* store.find(org, id)
      const held = yield* savedFor(id)
      expect([answer, O.getOrThrow(after).revision, held]).toEqual(["saved", 3, [[1, 0]]])
    })
  )

  it.effect("the confirm checks everything its judgement read, however much that is, and is written", () =>
    Effect.gen(function* () {
      const id = ImportId.make("00000000-0000-4000-8000-0000000000b0")
      const store = yield* ImportStore
      const now = yield* DateTime.now
      const found = yield* store.find(org, id)
      const before = O.getOrThrow(found)
      const write = (confirm: string, read: ItemsAsRead) =>
        ConfirmWrite.make({
          draft: id,
          fileName: "large.csv",
          confirm: ConfirmId.make(confirm),
          expected: before.revision,
          unsaved: { set: {}, clear: [] },
          plan: ConfirmPlan.make({ draft: id, rows: [] }),
          itemIds: [],
          read,
          audit: Activity.make({
            id: ActivityId.make(confirm),
            organizationId: org,
            actorId: marcus.id,
            actorName: marcus.name,
            action: "Imported items",
            detail: "",
            agent: O.none(),
            createdAt: now
          })
        })
      // The last of the 150,000 created rows is not the one there: nothing is written.
      const other = ItemsAsRead.make({
        ...everything,
        created: A.append(A.dropRight(everything.created, 1), { rowNumber: 1, part: 1 })
      })
      const refused = yield* store.commit(write("00000000-0000-4000-8000-0000000000c0", other))
      const done = yield* store.commit(write("00000000-0000-4000-8000-0000000000c1", everything))
      const held = yield* savedFor(id)
      expect([refused.kind, done.kind, held]).toEqual(["itemsChanged", "confirmed", [[1, 0]]])
    })
  )
})
