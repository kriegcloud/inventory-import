// Rows of a save that waited, on the real handlers and SQL, a fresh D1 for each rule (Benjamin, 2026-11-20: "Hold it,
// show both, ask"): such a row is written only while what is stored of it is one of the decisions the sender knows the
// server may hold, or one of those as a match since left it; otherwise it is named with what is stored, and the other
// rows are written. The same over the twins is in the catalog model's WaitedRows test; what lands between the comparison
// and the write is in MatchAtomic.
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as HttpApiTest from "effect/http-api/HttpApiTest"
import * as SqlClient from "effect/sql/SqlClient"
import { decisionFromFlags, type RowDecisionFlags } from "@inventory/catalog-contract/Decision"
import { ImportNotFound } from "@inventory/catalog-contract/ImportRejection"
import type { Field, StagedTable } from "@inventory/catalog-contract/Staged"
import { Forbidden } from "@inventory/kernel/AccessError"
import { Api } from "../../src/api/v1/Api.ts"
import { as, TypedApp } from "./support/app.ts"
import { upload } from "./support/upload.ts"

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
/** Row 2 compares the same with its stored item under both cost columns; row 3 otherwise; rows 4 and 5 are new. */
const reviewed = tableOf("reviewed.csv", [
  { ...item, sku: "AAA-0001", name: "Oak Crate", unit_cost: "99.00", "Net cost": "99.00", "Alt code": "ZZZ-0001" },
  { ...item, sku: "AAA-0002", name: "Steel Bolt XL", unit_cost: "3", "Net cost": "9.00", "Alt code": "ZZZ-0002" },
  { ...item, sku: "BBB-0001", name: "Hemp Rope", unit_cost: "1", "Net cost": "1", "Alt code": "YYY-0001" },
  { ...item, sku: "BBB-0002", name: "Nylon Rope", unit_cost: "2", "Net cost": "2", "Alt code": "YYY-0002" }
])

const marcus = as("mem_marcus")
const dana = as("mem_dana")
const flags = (set: Readonly<Record<string, RowDecisionFlags>>) => R.map(set, decisionFromFlags)
const some = (decision: RowDecisionFlags) => O.some(decisionFromFlags(decision))

type Save = {
  readonly on: number
  readonly set?: Readonly<Record<string, RowDecisionFlags>>
  readonly clear?: ReadonlyArray<string>
  readonly over?: Readonly<Record<string, ReadonlyArray<O.Option<RowDecisionFlags>>>>
}
const request = (save: Save) => {
  const set = flags(save.set ?? {})
  const clear = save.clear ?? []
  return {
    madeOn: R.fromEntries(A.map([...R.keys(set), ...clear], (row) => [row, save.on] as const)),
    set,
    clear,
    ...(save.over === undefined ? {} : { over: R.map(save.over, A.map(O.map(decisionFromFlags))) })
  }
}

/** The two items stocked, then the reviewed file staged; and what people do with it, each as themselves. */
const seeded = Effect.gen(function* () {
  const client = yield* HttpApiTest.groups(Api, ["imports"])
  const first = yield* upload({ client, table: stocked }).pipe(marcus)
  yield* client.imports
    .commit({ params: { id: first.id }, payload: { revision: first.revision, madeOn: {}, set: {}, clear: [] } })
    .pipe(marcus)
  const view = yield* upload({ client, table: reviewed }).pipe(marcus)
  const params = { id: view.id }
  return {
    client,
    view,
    params,
    marcusSaves: Effect.fnUntraced(function* (save: Omit<Save, "on">) {
      const now = yield* client.imports.get({ params }).pipe(marcus)
      return yield* client.imports.decide({ params, payload: request({ ...save, on: now.revision }) }).pipe(marcus)
    }),
    danaSaves: (save: Save) => client.imports.decide({ params, payload: request(save) }).pipe(dana),
    matched: (field: Field, heading: (typeof headings)[number]) =>
      client.imports.match({ params, payload: { field, column: O.some(column(heading)) } }).pipe(marcus),
    stored: (rows: ReadonlyArray<string>) =>
      Effect.map(client.imports.get({ params }).pipe(dana), (now) => A.map(rows, (row) => R.get(now.decisions, row)))
  }
})

layer(TypedApp)("a row that waited, set or cleared", (it) => {
  it.effect(
    "decided by somebody else since is named with theirs and not written; the save's other rows are written",
    () =>
      Effect.gen(function* () {
        const { view, marcusSaves, danaSaves, stored } = yield* seeded
        yield* marcusSaves({ set: { "row-4": { out: true }, "row-3": { stored: "keep" } } })
        // Row 3 is cleared over nothing, row 5 set over nothing; row 2 is a live press beside them.
        const saved = yield* danaSaves({
          on: view.revision,
          set: { "row-4": { edits: { name: "Rope" } }, "row-5": { out: true }, "row-2": { stored: "keep" } },
          clear: ["row-3"],
          over: { "row-4": [O.none()], "row-5": [O.none()], "row-3": [O.none()], "not-a-row": [O.none()] }
        })
        expect(saved).toEqual({
          revision: view.revision + 2,
          changed: true,
          notApplied: [],
          decidedSince: [
            { rowId: "row-4", theirs: some({ out: true }) },
            { rowId: "row-3", theirs: some({ stored: "keep" }) }
          ]
        })
        const now = yield* stored(["row-2", "row-3", "row-4", "row-5"])
        expect(now).toEqual([
          some({ stored: "keep" }),
          some({ stored: "keep" }),
          some({ out: true }),
          some({ out: true })
        ])
        // Use mine: theirs named among them, each row is written, the clear included.
        const used = yield* danaSaves({
          on: view.revision,
          set: { "row-4": { edits: { name: "Rope" } } },
          clear: ["row-3"],
          over: { "row-4": [O.none(), O.some({ out: true })], "row-3": [O.none(), O.some({ stored: "keep" })] }
        })
        expect([used.decidedSince, used.changed]).toEqual([[], true])
        const after = yield* stored(["row-3", "row-4"])
        expect(after).toEqual([O.none(), some({ edits: { name: "Rope" } })])
        // Every row held: nothing is written, and the draft stays where it was.
        const held = yield* danaSaves({ on: view.revision, clear: ["row-4"], over: { "row-4": [O.none()] } })
        expect(held).toEqual({
          revision: used.revision,
          changed: false,
          notApplied: [],
          decidedSince: [{ rowId: "row-4", theirs: some({ edits: { name: "Rope" } }) }]
        })
      })
  )
})

layer(TypedApp)("a row that waited, sent again after a lost answer", (it) => {
  it.effect("finds its own decision, set or cleared: nothing changes, and nothing is named", () =>
    Effect.gen(function* () {
      const { view, marcusSaves, danaSaves, stored } = yield* seeded
      yield* marcusSaves({ set: { "row-5": { out: true } } })
      // What is stored of row 4 says nothing: left out and put back, the same as no decision.
      yield* marcusSaves({ set: { "row-4": { out: true } } })
      yield* marcusSaves({ set: { "row-4": {} } })
      const save: Save = {
        on: view.revision,
        set: { "row-4": { out: true }, "row-2": { stored: "replace" } },
        clear: ["row-5"],
        over: { "row-4": [O.none()], "row-2": [O.none()], "row-5": [O.some({ out: true })] }
      }
      const first = yield* danaSaves(save)
      const second = yield* danaSaves(save)
      expect([first.decidedSince, first.changed, second]).toEqual([
        [],
        true,
        { revision: first.revision, changed: false, notApplied: [], decidedSince: [] }
      ])
      const now = yield* stored(["row-4", "row-2", "row-5"])
      expect(now).toEqual([some({ out: true }), some({ stored: "replace" }), O.none()])
    })
  )
})

layer(TypedApp)("a row that waited across a match", (it) => {
  it.effect("what the match took back of a decision named is nobody's; a colleague's own put-back is his", () =>
    Effect.gen(function* () {
      const { marcusSaves, danaSaves, matched, stored } = yield* seeded
      const replaced = yield* marcusSaves({
        set: { "row-2": { stored: "replace" }, "row-3": { stored: "replace" }, "row-4": { accepted: ["unitCost"] } }
      })
      yield* matched("unitCost", "Net cost")
      // Row 2 compares the same: its Replace stood until Marcus put it back himself.
      yield* marcusSaves({ set: { "row-2": {} } })
      const saved = yield* danaSaves({
        on: replaced.revision,
        set: { "row-2": { out: true }, "row-3": { out: true }, "row-4": { accepted: ["unitCost"], out: true } },
        over: {
          "row-2": [O.some({ stored: "replace" })],
          "row-3": [O.some({ stored: "replace" })],
          "row-4": [O.some({ accepted: ["unitCost"] })]
        }
      })
      expect([saved.decidedSince, saved.notApplied]).toEqual([
        [{ rowId: "row-2", theirs: O.none() }],
        [{ rowId: "row-4", field: "unitCost", kind: "accept" }]
      ])
      const now = yield* stored(["row-2", "row-3", "row-4"])
      expect(now).toEqual([some({}), some({ out: true }), some({ out: true })])
    })
  )
})

layer(TypedApp)("who may send rows that waited", (it) => {
  it.effect("a viewer is refused; another organization finds no import, and is told nothing of what is stored", () =>
    Effect.gen(function* () {
      const { client, view, params, marcusSaves, stored } = yield* seeded
      yield* marcusSaves({ set: { "row-4": { out: true } } })
      const payload = request({
        on: view.revision,
        set: { "row-4": { edits: { name: "Rope" } } },
        over: { "row-4": [O.some({ out: true })] }
      })
      const viewer = yield* Effect.flip(client.imports.decide({ params, payload }).pipe(as("mem_priya")))
      const stranger = yield* Effect.flip(client.imports.decide({ params, payload }).pipe(as("mem_elena")))
      expect([S.is(Forbidden)(viewer), S.is(ImportNotFound)(stranger)]).toEqual([true, true])
      const now = yield* stored(["row-4"])
      expect(now).toEqual([some({ out: true })])
    })
  )
})

/** A sack whose cost reads 5 under "unit_cost" and 7 under "Net cost": a match of the cost changes how it compares. */
const sackLine = { ...item, sku: "CCC-0001", name: "Jute Sack", unit_cost: "5", "Net cost": "7" }
/** One whose cost reads 3 under both: no match of the cost changes how it compares. */
const canvasLine = { ...item, sku: "CCC-0002", name: "Canvas Sack", unit_cost: "3", "Net cost": "3" }
const sacks = tableOf("sacks.csv", [sackLine, canvasLine])
const sackStock = tableOf("sack-stock.csv", [
  { ...item, sku: "CCC-0001", name: "Jute Sack", unit_cost: "5" },
  { ...item, sku: "CCC-0002", name: "Canvas Sack", unit_cost: "3" }
])
const mine = { stored: "replace", edits: { name: "Sack" } } satisfies RowDecisionFlags
/** A Replace with an accept of the cost: a match of the cost takes the accept in any case, the Replace only on row 2. */
const both = { stored: "replace", accepted: ["unitCost"] } satisfies RowDecisionFlags

/** The sacks staged; `stock` confirms another import that stocks them, and its `takeBack` takes that one back. */
const seededSacks = Effect.gen(function* () {
  const client = yield* HttpApiTest.groups(Api, ["imports"])
  const view = yield* upload({ client, table: sacks }).pipe(marcus)
  const params = { id: view.id }
  const stock = Effect.gen(function* () {
    const staged = yield* upload({ client, table: sackStock }).pipe(marcus)
    const at = { id: staged.id }
    yield* client.imports
      .commit({ params: at, payload: { revision: staged.revision, madeOn: {}, set: {}, clear: [] } })
      .pipe(marcus)
    const done = yield* client.imports.get({ params: at }).pipe(marcus)
    return {
      takeBack: client.imports.takeBack({ params: at, payload: { confirms: done.takeBack.confirms } }).pipe(marcus)
    }
  })
  const stored = (rows: ReadonlyArray<string>) =>
    Effect.map(client.imports.get({ params }).pipe(dana), (now) => A.map(rows, (row) => R.get(now.decisions, row)))
  return {
    client,
    view,
    params,
    stock,
    stored,
    danaSaves: (save: Save) => client.imports.decide({ params, payload: request(save) }).pipe(dana),
    marcusSaves: Effect.fnUntraced(function* (save: Omit<Save, "on">) {
      const now = yield* client.imports.get({ params }).pipe(marcus)
      return yield* client.imports.decide({ params, payload: request({ ...save, on: now.revision }) }).pipe(marcus)
    }),
    matched: () =>
      client.imports.match({ params, payload: { field: "unitCost", column: O.some(column("Net cost")) } }).pipe(marcus)
  }
})
const named = (since: ReadonlyArray<{ readonly rowId: string; readonly theirs: unknown }>) =>
  A.map(since, ({ rowId, theirs }) => [rowId, theirs] as const)
const waitedOverMine = (on: number): Save => ({
  on,
  set: { "row-2": { out: true } },
  over: { "row-2": [O.none(), O.some(mine)] }
})

layer(TypedApp)("a row that waited across a match, an item stocked since", (it) => {
  it.effect("a Replace the match left, put back by a colleague since: named with his, the item notwithstanding", () =>
    Effect.gen(function* () {
      const { view, stock, stored, danaSaves, marcusSaves, matched } = yield* seededSacks
      yield* danaSaves({ on: view.revision, set: { "row-2": mine } })
      // Nothing is stored under the sack's SKU: the match changes nothing of how it compares, and the Replace stands.
      yield* matched()
      const standing = yield* stored(["row-2"])
      expect(standing).toEqual([some(mine)])
      yield* marcusSaves({ set: { "row-2": { edits: { name: "Sack" } } } })
      yield* stock
      const saved = yield* danaSaves(waitedOverMine(view.revision))
      expect(named(saved.decidedSince)).toEqual([["row-2", some({ edits: { name: "Sack" } })]])
      const now = yield* stored(["row-2"])
      expect(now).toEqual([some({ edits: { name: "Sack" } })])
    })
  )
})

layer(TypedApp)("a row that waited across a match, no item stocked since", (it) => {
  it.effect("a Replace the match left, put back by a colleague since: named with his", () =>
    Effect.gen(function* () {
      const { view, stored, danaSaves, marcusSaves, matched } = yield* seededSacks
      yield* danaSaves({ on: view.revision, set: { "row-2": mine } })
      yield* matched()
      yield* marcusSaves({ set: { "row-2": { edits: { name: "Sack" } } } })
      const saved = yield* danaSaves(waitedOverMine(view.revision))
      expect(named(saved.decidedSince)).toEqual([["row-2", some({ edits: { name: "Sack" } })]])
      const now = yield* stored(["row-2"])
      expect(now).toEqual([some({ edits: { name: "Sack" } })])
    })
  )
})

layer(TypedApp)("a row that waited across a match, its item taken back since", (it) => {
  it.effect("a Replace the match took back: written over what the match left, the item gone notwithstanding", () =>
    Effect.gen(function* () {
      const { view, stock, stored, danaSaves, matched } = yield* seededSacks
      const stocked = yield* stock
      yield* danaSaves({ on: view.revision, set: { "row-2": mine } })
      const match = yield* matched()
      expect(A.map(match.takenBack, ({ field, kind, rows }) => [field, kind, rows])).toEqual([
        ["unitCost", "stored", ["row-2"]]
      ])
      yield* stocked.takeBack
      const saved = yield* danaSaves(waitedOverMine(view.revision))
      expect(saved.decidedSince).toEqual([])
      const now = yield* stored(["row-2"])
      expect(now).toEqual([some({ out: true })])
    })
  )
})

layer(TypedApp)("a row that waited across a match, its item still there", (it) => {
  it.effect("a Replace the match took back: written over what the match left", () =>
    Effect.gen(function* () {
      const { view, stock, stored, danaSaves, matched } = yield* seededSacks
      yield* stock
      yield* danaSaves({ on: view.revision, set: { "row-2": mine } })
      yield* matched()
      const saved = yield* danaSaves(waitedOverMine(view.revision))
      expect(saved.decidedSince).toEqual([])
      const now = yield* stored(["row-2"])
      expect(now).toEqual([some({ out: true })])
    })
  )
})

/** Row 2's Replace and row 3's accept taken back by a match of the cost, row 3's Replace standing; then a save over both. */
const takenAndStanding = Effect.gen(function* () {
  const seeded = yield* seededSacks
  yield* seeded.stock
  yield* seeded.danaSaves({ on: seeded.view.revision, set: { "row-2": mine, "row-3": both } })
  yield* seeded.matched()
  const left = yield* seeded.stored(["row-2", "row-3"])
  expect(left).toEqual([some({ edits: { name: "Sack" } }), some({ stored: "replace" })])
  const waited: Save = {
    on: seeded.view.revision,
    set: { "row-2": { out: true }, "row-3": { out: true } },
    over: { "row-2": [O.none(), O.some(mine)], "row-3": [O.none(), O.some(both)] }
  }
  return { ...seeded, waited }
})

layer(TypedApp)("a row that waited across a match whose take-backs are kept", (it) => {
  it.effect("the Replace the match took and the one that stood are both what the match left: written", () =>
    Effect.gen(function* () {
      const { waited, stored, danaSaves } = yield* takenAndStanding
      const saved = yield* danaSaves(waited)
      expect(saved.decidedSince).toEqual([])
      const now = yield* stored(["row-2", "row-3"])
      expect(now).toEqual([some({ out: true }), some({ out: true })])
    })
  )
})

layer(TypedApp)("a row that waited across a match whose take-backs a confirm let go", (it) => {
  it.effect("not known: named, the Replace the match took and the one that stood alike", () =>
    Effect.gen(function* () {
      const { client, params, waited, stored, danaSaves } = yield* takenAndStanding
      const before = yield* client.imports.get({ params }).pipe(marcus)
      yield* client.imports
        .commit({ params, payload: { revision: before.revision, madeOn: {}, set: {}, clear: [] } })
        .pipe(marcus)
      yield* client.imports.reopen({ params }).pipe(marcus)
      const saved = yield* danaSaves(waited)
      expect(named(saved.decidedSince)).toEqual([
        ["row-2", some({ edits: { name: "Sack" } })],
        ["row-3", some({ stored: "replace" })]
      ])
      const now = yield* stored(["row-2", "row-3"])
      expect(now).toEqual([some({ edits: { name: "Sack" } }), some({ stored: "replace" })])
    })
  )
})

const keepSack = { stored: "keep", edits: { name: "Sack" } } satisfies RowDecisionFlags

layer(TypedApp)("a row that waited across a match that took a colleague's Keep-stored", (it) => {
  it.effect("what the match left of his reads as hers would: named with his, not written", () =>
    Effect.gen(function* () {
      const { view, stock, stored, danaSaves, marcusSaves, matched } = yield* seededSacks
      yield* stock
      // Dana's Replace lands and its answer is lost; Marcus decides the row since, and the match takes his Keep-stored.
      yield* danaSaves({ on: view.revision, set: { "row-2": mine } })
      yield* marcusSaves({ set: { "row-2": keepSack } })
      const match = yield* matched()
      expect(A.map(match.takenBack, ({ field, kind, rows }) => [field, kind, rows])).toEqual([
        ["unitCost", "stored", ["row-2"]]
      ])
      const saved = yield* danaSaves(waitedOverMine(view.revision))
      expect(named(saved.decidedSince)).toEqual([["row-2", some({ edits: { name: "Sack" } })]])
      const now = yield* stored(["row-2"])
      expect(now).toEqual([some({ edits: { name: "Sack" } })])
    })
  )
})

layer(TypedApp)("a row that waited across a match, a colleague's name alone since", (it) => {
  it.effect("nothing taken back: named with his", () =>
    Effect.gen(function* () {
      const { view, stock, stored, danaSaves, marcusSaves, matched } = yield* seededSacks
      yield* stock
      yield* danaSaves({ on: view.revision, set: { "row-2": mine } })
      yield* marcusSaves({ set: { "row-2": { edits: { name: "Sack" } } } })
      const match = yield* matched()
      expect(match.takenBack).toEqual([])
      const saved = yield* danaSaves(waitedOverMine(view.revision))
      expect(named(saved.decidedSince)).toEqual([["row-2", some({ edits: { name: "Sack" } })]])
      const now = yield* stored(["row-2"])
      expect(now).toEqual([some({ edits: { name: "Sack" } })])
    })
  )
})

layer(TypedApp)("a row that waited across a match that took a colleague's Replace", (it) => {
  it.effect("a Keep-stored of hers waiting over it: named with his, not written", () =>
    Effect.gen(function* () {
      const { view, stock, stored, danaSaves, marcusSaves, matched } = yield* seededSacks
      yield* stock
      yield* danaSaves({ on: view.revision, set: { "row-2": keepSack } })
      yield* marcusSaves({ set: { "row-2": mine } })
      yield* matched()
      const saved = yield* danaSaves({
        on: view.revision,
        set: { "row-2": { out: true } },
        over: { "row-2": [O.none(), O.some(keepSack)] }
      })
      expect(named(saved.decidedSince)).toEqual([["row-2", some({ edits: { name: "Sack" } })]])
      const now = yield* stored(["row-2"])
      expect(now).toEqual([some({ edits: { name: "Sack" } })])
    })
  )
})

layer(TypedApp)(
  "a row that waited across a match whose entry is from before it said which decision it took from",
  (it) => {
    it.effect("cannot say: named, not written", () =>
      Effect.gen(function* () {
        const { view, params, stock, stored, danaSaves, matched } = yield* seededSacks
        yield* stock
        yield* danaSaves({ on: view.revision, set: { "row-2": mine } })
        yield* matched()
        const sql = yield* SqlClient.SqlClient
        yield* sql`UPDATE importDraft SET takenBackJson = (SELECT json_group_array(json(json_remove(value, '$.saved')))
        FROM json_each(takenBackJson)) WHERE id = ${params.id}`
        const saved = yield* danaSaves(waitedOverMine(view.revision))
        expect(named(saved.decidedSince)).toEqual([["row-2", some({ edits: { name: "Sack" } })]])
        const now = yield* stored(["row-2"])
        expect(now).toEqual([some({ edits: { name: "Sack" } })])
      })
    )
  }
)

layer(TypedApp)("a row that waited, her own save not applying its Replace", (it) => {
  it.effect("its item taken back since: what her save stored is hers, and the row is written", () =>
    Effect.gen(function* () {
      const { view, stock, stored, danaSaves, matched } = yield* seededSacks
      const stocked = yield* stock
      yield* matched()
      // Made before the match, her save lands after it and does not apply the Replace; its answer is lost.
      const first = yield* danaSaves({ on: view.revision, set: { "row-2": mine }, over: { "row-2": [O.none()] } })
      expect([first.decidedSince, first.notApplied]).toEqual([
        [],
        [{ rowId: "row-2", field: "unitCost", kind: "stored" }]
      ])
      yield* stocked.takeBack
      const saved = yield* danaSaves(waitedOverMine(view.revision))
      expect(saved.decidedSince).toEqual([])
      const now = yield* stored(["row-2"])
      expect(now).toEqual([some({ out: true })])
    })
  )
})

/** A member as the D1 tests act: their id, and the pipe that runs a request as them. */
const people = { dana: { id: "mem_dana", act: dana }, marcus: { id: "mem_marcus", act: marcus } }
type Person = (typeof people)[keyof typeof people]

/** The sacks staged and stocked; a save sent as a person waited (`sends`) or live (`presses`); and who row 2 is credited to. */
const sacksStocked = Effect.gen(function* () {
  const seeded = yield* seededSacks
  const stocked = yield* seeded.stock
  const { client, params } = seeded
  const sends = (who: Person) => (save: Save) => client.imports.decide({ params, payload: request(save) }).pipe(who.act)
  const presses = (who: Person) =>
    Effect.fnUntraced(function* (save: Omit<Save, "on">) {
      const now = yield* client.imports.get({ params }).pipe(who.act)
      return yield* sends(who)({ ...save, on: now.revision })
    })
  const credit = Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql<{ decidedById: string; savedRevision: number; lastSavedById: string | null }>`
      SELECT decidedById, savedRevision, lastSavedById FROM importDecision
      WHERE importId = ${params.id} AND rowId = 'row-2'`
    return rows
  })
  const cost = () =>
    client.imports.match({ params, payload: { field: "unitCost", column: O.some(column("Net cost")) } }).pipe(marcus)
  return { ...seeded, stocked, sends, presses, credit, cost }
})

A.forEach(
  [
    { sender: people.dana, colleague: people.marcus },
    { sender: people.marcus, colleague: people.dana }
  ],
  ({ sender, colleague }) =>
    layer(TypedApp)(
      `a row that waited, a colleague's save of exactly what is stored since (${sender.id} waits)`,
      (it) => {
        it.effect("named with what is stored, not written; who it is credited to stays", () =>
          Effect.gen(function* () {
            const { view, sends, presses, cost, stored, credit } = yield* sacksStocked
            // Her Replace lands and its answer is lost; the match takes the Replace back, the name stays hers.
            yield* sends(sender)({ on: view.revision, set: { "row-2": mine } })
            yield* cost()
            const hers = yield* credit
            const his = yield* presses(colleague)({ set: { "row-2": { edits: { name: "Sack" } } } })
            expect(his.changed).toBe(false)
            const after = yield* credit
            expect([hers, after]).toEqual([
              [{ decidedById: sender.id, savedRevision: view.revision + 1, lastSavedById: sender.id }],
              [{ decidedById: sender.id, savedRevision: view.revision + 1, lastSavedById: colleague.id }]
            ])
            const saved = yield* sends(sender)(waitedOverMine(view.revision))
            expect(named(saved.decidedSince)).toEqual([["row-2", some({ edits: { name: "Sack" } })]])
            const now = yield* stored(["row-2"])
            expect(now).toEqual([some({ edits: { name: "Sack" } })])
          })
        )
      }
    )
)

layer(TypedApp)("a row that waited, a colleague's screen behind the match since", (it) => {
  it.effect("he removes the Replace his screen still shows: what is stored stays, and her row is named", () =>
    Effect.gen(function* () {
      const { view, sends, cost, stored } = yield* sacksStocked
      yield* sends(people.dana)({ on: view.revision, set: { "row-2": mine } })
      const shown = yield* cost()
      const his = yield* sends(people.marcus)({
        on: shown.revision - 1,
        set: { "row-2": { edits: { name: "Sack" } } }
      })
      expect([his.changed, his.notApplied]).toEqual([false, []])
      const saved = yield* sends(people.dana)(waitedOverMine(view.revision))
      expect(named(saved.decidedSince)).toEqual([["row-2", some({ edits: { name: "Sack" } })]])
      const now = yield* stored(["row-2"])
      expect(now).toEqual([some({ edits: { name: "Sack" } })])
    })
  )
})

layer(TypedApp)("a row that waited, her save sent twice", (it) => {
  it.effect("the second after the match changes nothing and leaves it hers: written", () =>
    Effect.gen(function* () {
      const { view, sends, cost, stored, credit } = yield* sacksStocked
      yield* sends(people.dana)({ on: view.revision, set: { "row-2": mine } })
      yield* cost()
      const again = yield* sends(people.dana)({
        on: view.revision,
        set: { "row-2": mine },
        over: { "row-2": [O.none()] }
      })
      expect(again.changed).toBe(false)
      const last = yield* credit
      expect(A.map(last, (row) => row.lastSavedById)).toEqual(["mem_dana"])
      const saved = yield* sends(people.dana)(waitedOverMine(view.revision))
      expect(saved.decidedSince).toEqual([])
      const now = yield* stored(["row-2"])
      expect(now).toEqual([some({ out: true })])
    })
  )
})

layer(TypedApp)("a row that waited, her own other save of what is stored", (it) => {
  it.effect("from another tab, after the match: still hers, written", () =>
    Effect.gen(function* () {
      const { view, sends, presses, cost, stored } = yield* sacksStocked
      yield* sends(people.dana)({ on: view.revision, set: { "row-2": mine } })
      yield* cost()
      const other = yield* presses(people.dana)({ set: { "row-2": { edits: { name: "Sack" } } } })
      expect(other.changed).toBe(false)
      const saved = yield* sends(people.dana)(waitedOverMine(view.revision))
      expect(saved.decidedSince).toEqual([])
      const now = yield* stored(["row-2"])
      expect(now).toEqual([some({ out: true })])
    })
  )
})

layer(TypedApp)("a row that waited, a colleague's save of what is stored on the revision her screen had", (it) => {
  it.effect("it may have come after her screen read it: named, not written", () =>
    Effect.gen(function* () {
      const { view, sends, presses, cost, stored } = yield* sacksStocked
      const first = yield* sends(people.dana)({ on: view.revision, set: { "row-2": mine } })
      const his = yield* presses(people.marcus)({ set: { "row-2": mine } })
      expect([his.changed, his.revision]).toEqual([false, first.revision])
      yield* cost()
      const saved = yield* sends(people.dana)({
        on: first.revision,
        set: { "row-2": { out: true } },
        over: { "row-2": [O.some(mine)] }
      })
      expect(named(saved.decidedSince)).toEqual([["row-2", some({ edits: { name: "Sack" } })]])
      const now = yield* stored(["row-2"])
      expect(now).toEqual([some({ edits: { name: "Sack" } })])
    })
  )
})

layer(TypedApp)(
  "a row that waited, her own save not applying its Replace, the item taken back and stocked again",
  (it) => {
    it.effect("what her save stored is hers, and the row is written", () =>
      Effect.gen(function* () {
        const { view, stocked, stock, sends, cost, stored } = yield* sacksStocked
        yield* cost()
        // Made before the match, her save lands after it and does not apply the Replace; its answer is lost.
        const first = yield* sends(people.dana)({
          on: view.revision,
          set: { "row-2": mine },
          over: { "row-2": [O.none()] }
        })
        expect([first.decidedSince, first.notApplied]).toEqual([
          [],
          [{ rowId: "row-2", field: "unitCost", kind: "stored" }]
        ])
        yield* stocked.takeBack
        yield* stock
        const saved = yield* sends(people.dana)(waitedOverMine(view.revision))
        expect(saved.decidedSince).toEqual([])
        const now = yield* stored(["row-2"])
        expect(now).toEqual([some({ out: true })])
      })
    )
  }
)

layer(TypedApp)("a row that waited across a match, her own decision taken from", (it) => {
  const rope = { accepted: ["unitCost", "uom"], edits: { name: "Rope" } } satisfies RowDecisionFlags
  it.effect("named as her screen showed it between two matches: hers, and written; his, after both, named", () =>
    Effect.gen(function* () {
      const { view, marcusSaves, danaSaves, matched, stored } = yield* seeded
      yield* danaSaves({ on: view.revision, set: { "row-4": rope } })
      yield* marcusSaves({ set: { "row-5": rope } })
      const first = yield* matched("unitCost", "Net cost")
      const second = yield* matched("uom", "Alt code")
      // Row 4 is hers, named as her screen showed it between the matches. Row 5 is his, named as he saved it, by her
      // press made after both: what the matches left of his is not known to her.
      const saved = yield* danaSaves({
        on: first.revision,
        set: { "row-4": { out: true } },
        over: { "row-4": [O.some({ accepted: ["uom"], edits: { name: "Rope" } })] }
      })
      const again = yield* danaSaves({
        on: second.revision,
        set: { "row-5": { out: true } },
        over: { "row-5": [O.some(rope)] }
      })
      expect([saved.decidedSince, named(again.decidedSince)]).toEqual([
        [],
        [["row-5", some({ edits: { name: "Rope" } })]]
      ])
      const now = yield* stored(["row-4", "row-5"])
      expect(now).toEqual([some({ out: true }), some({ edits: { name: "Rope" } })])
    })
  )

  it.effect("named as she sent it by her press made after both matches: hers, and written", () =>
    Effect.gen(function* () {
      const { view, danaSaves, matched, stored } = yield* seeded
      yield* danaSaves({ on: view.revision, set: { "row-4": rope } })
      yield* matched("unitCost", "Net cost")
      const second = yield* matched("uom", "Alt code")
      const saved = yield* danaSaves({
        on: second.revision,
        set: { "row-4": { out: true } },
        over: { "row-4": [O.some(rope)] }
      })
      expect(saved.decidedSince).toEqual([])
      const now = yield* stored(["row-4"])
      expect(now).toEqual([some({ out: true })])
    })
  )

  it.effect("saved again unchanged by the other one of them: not hers, named", () =>
    Effect.gen(function* () {
      const { view, marcusSaves, danaSaves, matched, stored } = yield* seeded
      // Row 4 is hers, saved again by Marcus unchanged after the match; row 5 is his, saved again by her unchanged
      // before it.
      yield* danaSaves({ on: view.revision, set: { "row-4": rope } })
      yield* marcusSaves({ set: { "row-5": rope } })
      const mine = yield* danaSaves({ on: view.revision + 2, set: { "row-5": rope } })
      expect(mine.changed).toBe(false)
      const match = yield* matched("unitCost", "Net cost")
      const his = yield* marcusSaves({ set: { "row-4": { accepted: ["uom"], edits: { name: "Rope" } } } })
      expect(his.changed).toBe(false)
      // A save of another row moves the draft on: her screen reads it after his save.
      const moved = yield* danaSaves({ on: match.revision, set: { "row-2": { out: true } } })
      const saved = yield* danaSaves({
        on: moved.revision,
        set: { "row-4": { out: true }, "row-5": { out: true } },
        over: { "row-4": [O.some(rope)], "row-5": [O.some(rope)] }
      })
      const left = some({ accepted: ["uom"], edits: { name: "Rope" } })
      expect(named(saved.decidedSince)).toEqual([
        ["row-4", left],
        ["row-5", left]
      ])
      const now = yield* stored(["row-4", "row-5"])
      expect(now).toEqual([left, left])
    })
  )
})
