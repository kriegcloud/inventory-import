// Rows of a save that waited (Benjamin, 2026-11-20: "Hold it, show both, ask"): such a row is written only while what is
// stored of it is one of the decisions the sender knows the server may hold, or one of those as a match since left it.
// Anything else is somebody's decision made since: it stays, the save names it, and the save's other rows are written.
// The comparison and the write are one thing, whatever lands in between. Over the in-memory twins; the same on D1 is in
// the app's WaitedRows and MatchAtomic slow tests.
import { describe, expect, layer } from "@effect/vitest"
import { type DecidedSince, decisionFromFlags, type RowDecisionFlags } from "@inventory/catalog-contract/Decision"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import { AlreadyImported, DraftBusy, ImportNotFound, RevisionAhead } from "@inventory/catalog-contract/ImportRejection"
import type { Field, StagedTable } from "@inventory/catalog-contract/Staged"
import { takenBackRowsNamed } from "@inventory/catalog-contract/Import"
import { decisionsMoved, draftTries, ImportStore } from "@inventory/catalog-model/ImportStore"
import { importsEndpoints } from "@inventory/catalog-model/ImportsHandler"
import { ItemsOfRow } from "@inventory/catalog-model/ItemsOfRow"
import { type ItemsOfRow as ItemsOfRowShape, itemsOfRow } from "@inventory/catalog-model/Review"
import { catalogMemory } from "@inventory/catalog-model/Memory"
import { Forbidden } from "@inventory/kernel/AccessError"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as MutableRef from "effect/MutableRef"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as SecureRandom from "effect/crypto/SecureRandom"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { as, dana, elena, marcus, priya, stage } from "./support.ts"

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
/** Row 2 compares the same with its stored item under both cost columns; row 3 otherwise; rows 4 and 5 are new. */
const reviewed = tableOf("reviewed.csv", [
  { ...item, sku: "AAA-0001", name: "Oak Crate", unit_cost: "99.00", "Net cost": "99.00", "Alt code": "ZZZ-0001" },
  { ...item, sku: "AAA-0002", name: "Steel Bolt XL", unit_cost: "3", "Net cost": "9.00", "Alt code": "ZZZ-0002" },
  { ...item, sku: "BBB-0001", name: "Hemp Rope", unit_cost: "1", "Net cost": "1", "Alt code": "YYY-0001" },
  { ...item, sku: "BBB-0002", name: "Nylon Rope", unit_cost: "2", "Net cost": "2", "Alt code": "YYY-0002" }
])

const flags = (set: Readonly<Record<string, RowDecisionFlags>>) => R.map(set, decisionFromFlags)
const some = (decision: RowDecisionFlags) => O.some(decisionFromFlags(decision))

/** The two items stocked, then the reviewed file staged; and what people do with it, each as themselves. */
const seeded = Effect.gen(function* () {
  const imports = yield* importsEndpoints
  const first = yield* stage(stocked).pipe(as(marcus))
  yield* imports
    .commit({ params: { id: first.id }, payload: { revision: first.revision, madeOn: {}, set: {}, clear: [] } })
    .pipe(as(marcus))
  const view = yield* stage(reviewed).pipe(as(marcus))
  return { imports, view, ...people(imports, view.id) }
})

type Imports = Effect.Success<typeof importsEndpoints>

/** A save of rows as a screen sends it: what it sets and clears, the revision they were made on, and what they waited over. */
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
const people = (imports: Imports, id: ImportId) => {
  const params = { id }
  return {
    params,
    /** Marcus saves live, on whatever the draft is at: the colleague. */
    marcusSaves: Effect.fnUntraced(function* (save: Omit<Save, "on">) {
      const now = yield* imports.get({ params }).pipe(as(marcus))
      return yield* imports.decide({ params, payload: request({ ...save, on: now.revision }) }).pipe(as(marcus))
    }),
    /** Dana's save, with the rows that waited. */
    danaSaves: (save: Save) => imports.decide({ params, payload: request(save) }).pipe(as(dana)),
    matched: (field: Field, heading: (typeof headings)[number]) =>
      imports.match({ params, payload: { field, column: O.some(column(heading)) } }).pipe(as(marcus)),
    stored: (rows: ReadonlyArray<string>) =>
      Effect.map(imports.get({ params }).pipe(as(dana)), (now) => A.map(rows, (row) => R.get(now.decisions, row)))
  }
}

const named = (since: ReadonlyArray<DecidedSince>) => A.map(since, ({ rowId, theirs }) => [rowId, theirs] as const)

describe("a row that waited", () => {
  layer(App)("is written only while what is stored is one of the decisions named", (it) => {
    it.effect(
      "decided by somebody else since: not written, named with theirs, and the save's other rows are written",
      () =>
        Effect.gen(function* () {
          const { view, marcusSaves, danaSaves, stored } = yield* seeded
          yield* marcusSaves({ set: { "row-4": { out: true } } })
          const saved = yield* danaSaves({
            on: view.revision,
            set: { "row-4": { edits: { name: "Hemp Rope 10m" } }, "row-5": { out: true }, "row-2": { stored: "keep" } },
            over: { "row-4": [O.none()], "row-5": [O.none()] }
          })
          expect([named(saved.decidedSince), saved.changed, saved.revision]).toEqual([
            [["row-4", some({ out: true })]],
            true,
            view.revision + 2
          ])
          const now = yield* stored(["row-4", "row-5", "row-2"])
          expect(now).toEqual([some({ out: true }), some({ out: true }), some({ stored: "keep" })])
        })
    )

    it.effect("what is stored is one of those named: written", () =>
      Effect.gen(function* () {
        const { view, marcusSaves, danaSaves, stored } = yield* seeded
        yield* marcusSaves({ set: { "row-4": { out: true } } })
        const saved = yield* danaSaves({
          on: view.revision,
          set: { "row-4": { out: true, edits: { name: "Hemp Rope 10m" } } },
          over: { "row-4": [O.none(), O.some({ edits: { name: "Rope" } }), O.some({ out: true })] }
        })
        expect([saved.decidedSince, saved.changed]).toEqual([[], true])
        const now = yield* stored(["row-4"])
        expect(now).toEqual([some({ out: true, edits: { name: "Hemp Rope 10m" } })])
      })
    )

    it.effect(
      "a decision that says nothing and no decision are the same, whichever is stored and whichever is named",
      () =>
        Effect.gen(function* () {
          const { view, marcusSaves, danaSaves, stored } = yield* seeded
          // Left out and put back by Marcus: what is stored of row 4 says nothing. Row 5 has no decision.
          yield* marcusSaves({ set: { "row-4": { out: true } } })
          yield* marcusSaves({ set: { "row-4": {} } })
          const saved = yield* danaSaves({
            on: view.revision,
            set: { "row-4": { out: true }, "row-5": { out: true } },
            over: { "row-4": [O.none()], "row-5": [O.some({})] }
          })
          expect(saved.decidedSince).toEqual([])
          const now = yield* stored(["row-4", "row-5"])
          expect(now).toEqual([some({ out: true }), some({ out: true })])
          // A stored decision that says nothing, named by neither: the row is held, and nothing is said to be theirs.
          yield* marcusSaves({ set: { "row-4": {} } })
          const held = yield* danaSaves({
            on: view.revision,
            set: { "row-4": { edits: { name: "Rope" } } },
            over: { "row-4": [O.some({ out: true })] }
          })
          expect(named(held.decidedSince)).toEqual([["row-4", O.none()]])
        })
    )

    it.effect("cleared while somebody else decided it since: theirs stays; cleared over what was named: gone", () =>
      Effect.gen(function* () {
        const { view, marcusSaves, danaSaves, stored } = yield* seeded
        const first = yield* marcusSaves({ set: { "row-4": { out: true }, "row-5": { out: true } } })
        yield* marcusSaves({ set: { "row-4": { edits: { name: "Rope" } } } })
        const saved = yield* danaSaves({
          on: first.revision,
          clear: ["row-4", "row-5"],
          over: { "row-4": [O.some({ out: true })], "row-5": [O.some({ out: true })] }
        })
        expect([named(saved.decidedSince), saved.changed]).toEqual([
          [["row-4", some({ edits: { name: "Rope" } })]],
          true
        ])
        const now = yield* stored(["row-4", "row-5"])
        expect(now).toEqual([some({ edits: { name: "Rope" } }), O.none()])
        // Cleared again over the same: the clear that was written finds its own.
        const again = yield* danaSaves({
          on: view.revision,
          clear: ["row-5"],
          over: { "row-5": [O.some({ out: true })] }
        })
        expect([again.decidedSince, again.changed]).toEqual([[], false])
      })
    )

    it.effect("sent twice (the answer was lost): the second changes nothing and names nothing", () =>
      Effect.gen(function* () {
        const { view, danaSaves, stored } = yield* seeded
        const save: Save = {
          on: view.revision,
          set: { "row-4": { out: true }, "row-2": { stored: "replace" } },
          over: { "row-4": [O.none()], "row-2": [O.none()] }
        }
        const first = yield* danaSaves(save)
        const second = yield* danaSaves(save)
        expect([first.changed, second]).toEqual([
          true,
          { revision: first.revision, changed: false, notApplied: [], decidedSince: [] }
        ])
        const now = yield* stored(["row-4", "row-2"])
        expect(now).toEqual([some({ out: true }), some({ stored: "replace" })])
      })
    )

    it.effect("Use mine: named again with theirs among them, it is written over theirs", () =>
      Effect.gen(function* () {
        const { view, marcusSaves, danaSaves, stored } = yield* seeded
        yield* marcusSaves({ set: { "row-4": { out: true } } })
        const mine: Save = {
          on: view.revision,
          set: { "row-4": { edits: { name: "Rope" } } },
          over: { "row-4": [O.none()] }
        }
        const held = yield* danaSaves(mine)
        const theirs = O.getOrThrow(A.head(held.decidedSince)).theirs
        expect(theirs).toEqual(some({ out: true }))
        const used = yield* danaSaves({ ...mine, over: { "row-4": [O.none(), O.some({ out: true })] } })
        expect([used.decidedSince, used.changed]).toEqual([[], true])
        const now = yield* stored(["row-4"])
        expect(now).toEqual([some({ edits: { name: "Rope" } })])
      })
    )

    it.effect(
      "every row of the save decided otherwise since: nothing is written, and nothing of them is taken back",
      () =>
        Effect.gen(function* () {
          const { view, marcusSaves, danaSaves, matched, stored } = yield* seeded
          // Dana accepted row 4's unit before the unit was matched again; Marcus left the row out since.
          yield* matched("uom", "Alt code")
          const theirs = yield* marcusSaves({ set: { "row-4": { out: true } } })
          const saved = yield* danaSaves({
            on: view.revision,
            set: { "row-4": { accepted: ["uom"] } },
            over: { "row-4": [O.none()] }
          })
          expect(saved).toEqual({
            revision: theirs.revision,
            changed: false,
            notApplied: [],
            decidedSince: [{ rowId: "row-4", theirs: some({ out: true }) }]
          })
          const now = yield* stored(["row-4"])
          expect(now).toEqual([some({ out: true })])
        })
    )
  })
})

describe("a row that did not wait", () => {
  layer(App)("is a live press: the last one stands", (it) => {
    it.effect(
      "a row beside those named in `over`, and a key of `over` that names no row of the save, are not compared",
      () =>
        Effect.gen(function* () {
          const { view, marcusSaves, danaSaves, stored } = yield* seeded
          yield* marcusSaves({ set: { "row-4": { out: true }, "row-5": { out: true } } })
          const saved = yield* danaSaves({
            on: view.revision,
            set: { "row-4": { edits: { name: "Rope" } } },
            over: { "row-5": [O.none()], "not-a-row": [O.none()] }
          })
          expect([saved.decidedSince, saved.changed]).toEqual([[], true])
          const now = yield* stored(["row-4", "row-5"])
          expect(now).toEqual([some({ edits: { name: "Rope" } }), some({ out: true })])
        })
    )
  })
})

describe("a row that waited across a match", () => {
  layer(App)("what a match took back of a decision named is nobody's decision since", (it) => {
    it.effect(
      "the SKU matched again: the Replace named is stored as nothing, and what is left of the row is written",
      () =>
        Effect.gen(function* () {
          const { marcusSaves, danaSaves, matched, stored } = yield* seeded
          const replaced = yield* marcusSaves({ set: { "row-2": { stored: "replace" } } })
          yield* matched("sku", "Alt code")
          const before = yield* stored(["row-2"])
          expect(before).toEqual([some({})])
          const saved = yield* danaSaves({
            on: replaced.revision,
            set: { "row-2": { stored: "replace", edits: { name: "Crate" } } },
            over: { "row-2": [O.some({ stored: "replace" })] }
          })
          expect([saved.decidedSince, saved.notApplied]).toEqual([
            [],
            [{ rowId: "row-2", field: "sku", kind: "stored" }]
          ])
          const now = yield* stored(["row-2"])
          expect(now).toEqual([some({ edits: { name: "Crate" } })])
        })
    )

    it.effect("another column matched again: taken back where it changed how the row compares, and only there", () =>
      Effect.gen(function* () {
        const { marcusSaves, danaSaves, matched, stored } = yield* seeded
        const replaced = yield* marcusSaves({
          set: { "row-2": { stored: "replace" }, "row-3": { stored: "replace", accepted: ["unitCost"] } }
        })
        yield* matched("unitCost", "Net cost")
        // Row 3 compares otherwise: the match took its Replace and its accept. Row 2 compares the same: its Replace
        // stood until Marcus took it back himself, which is his decision.
        yield* marcusSaves({ set: { "row-2": {} } })
        const before = yield* stored(["row-2", "row-3"])
        expect(before).toEqual([some({}), some({})])
        const saved = yield* danaSaves({
          on: replaced.revision,
          set: { "row-2": { out: true }, "row-3": { out: true } },
          over: {
            "row-2": [O.some({ stored: "replace" })],
            "row-3": [O.some({ stored: "replace", accepted: ["unitCost"] })]
          }
        })
        expect(named(saved.decidedSince)).toEqual([["row-2", O.none()]])
        const now = yield* stored(["row-2", "row-3"])
        expect(now).toEqual([some({}), some({ out: true })])
      })
    )

    it.effect("several decisions named, the second the one the match rewrote: each is judged", () =>
      Effect.gen(function* () {
        const { marcusSaves, danaSaves, matched, stored } = yield* seeded
        const replaced = yield* marcusSaves({ set: { "row-3": { stored: "replace", edits: { name: "Bolt" } } } })
        yield* matched("unitCost", "Net cost")
        const saved = yield* danaSaves({
          on: replaced.revision,
          set: { "row-3": { out: true } },
          over: { "row-3": [O.none(), O.some({ stored: "replace", edits: { name: "Bolt" } })] }
        })
        expect(saved.decidedSince).toEqual([])
        const now = yield* stored(["row-3"])
        expect(now).toEqual([some({ out: true })])
      })
    )

    it.effect("a cleared row is judged on its revision too, and a revision the draft has not reached is refused", () =>
      Effect.gen(function* () {
        const { marcusSaves, danaSaves, matched, stored } = yield* seeded
        const matchedAgain = yield* matched("uom", "Alt code")
        const accepted = yield* marcusSaves({ set: { "row-4": { accepted: ["uom"], edits: { name: "Rope" } } } })
        // Marcus took the accept back himself, after the match: what is stored is his, not what a match left.
        yield* marcusSaves({ set: { "row-4": { edits: { name: "Rope" } } } })
        const save = { clear: ["row-4"], over: { "row-4": [O.some({ accepted: ["uom"], edits: { name: "Rope" } })] } }
        const held = yield* danaSaves({ ...save, on: accepted.revision })
        expect([matchedAgain.revision < accepted.revision, named(held.decidedSince)]).toEqual([
          true,
          [["row-4", some({ edits: { name: "Rope" } })]]
        ])
        const ahead = yield* Effect.flip(danaSaves({ ...save, on: 999_999 }))
        expect(S.is(RevisionAhead)(ahead)).toBe(true)
        // Made before the match, the same accept would have been taken back by it: the row is cleared.
        const cleared = yield* danaSaves({ ...save, on: matchedAgain.revision - 1 })
        expect(cleared.decidedSince).toEqual([])
        const now = yield* stored(["row-4"])
        expect(now).toEqual([O.none()])
      })
    )
  })
})

/** A sack whose cost reads 5 under "unit_cost" and 7 under "Net cost": a match of the cost changes how it compares. */
const sackLine = { ...item, sku: "CCC-0001", name: "Jute Sack", unit_cost: "5", "Net cost": "7" }
/** One whose cost reads 3 under both: no match of the cost changes how it compares. */
const canvasLine = { ...item, sku: "CCC-0002", name: "Canvas Sack", unit_cost: "3", "Net cost": "3" }
const sacks = tableOf("sacks.csv", [
  sackLine,
  canvasLine,
  { ...item, sku: "DDD-0001", name: "Burlap Sack", unit_cost: "2" }
])
const sackStock = tableOf("sack-stock.csv", [
  { ...item, sku: "CCC-0001", name: "Jute Sack", unit_cost: "5" },
  { ...item, sku: "CCC-0002", name: "Canvas Sack", unit_cost: "3" }
])
const mine = { stored: "replace", edits: { name: "Sack" } } satisfies RowDecisionFlags
/** A Replace with an accept of the cost: a match of the cost takes the accept in any case, the Replace only on row 2. */
const both = { stored: "replace", accepted: ["unitCost"] } satisfies RowDecisionFlags

/** Another import that stocks the sack, confirmed by Marcus; `takeBack` takes it back again. */
const stockSack = Effect.gen(function* () {
  const imports = yield* importsEndpoints
  const staged = yield* stage(sackStock).pipe(as(marcus))
  const params = { id: staged.id }
  yield* imports
    .commit({ params, payload: { revision: staged.revision, madeOn: {}, set: {}, clear: [] } })
    .pipe(as(marcus))
  const done = yield* imports.get({ params }).pipe(as(marcus))
  return {
    takeBack: imports.takeBack({ params, payload: { confirms: done.takeBack.confirms } }).pipe(as(marcus))
  }
})

/** The sacks staged, as each person works on them. */
const seededSacks = Effect.gen(function* () {
  const imports = yield* importsEndpoints
  const view = yield* stage(sacks).pipe(as(marcus))
  return { imports, view, ...people(imports, view.id) }
})

describe("a row that waited across a match, and the items since", () => {
  // Each on a store of its own: an item one stocks is never another's.
  const alone = (name: string, body: () => Effect.Effect<void, unknown, Layer.Success<typeof App>>) =>
    layer(App)(name, (it) => it.effect(name, body))

  alone("a Replace the match left, put back by a colleague since: named, though an item was stocked since", () =>
    Effect.gen(function* () {
      const { view, danaSaves, marcusSaves, matched, stored } = yield* seededSacks
      yield* danaSaves({ on: view.revision, set: { "row-2": mine } })
      // Nothing is stored under the sack's SKU: the match changes nothing of how it compares, and the Replace stands.
      yield* matched("unitCost", "Net cost")
      const standing = yield* stored(["row-2"])
      expect(standing).toEqual([some(mine)])
      yield* marcusSaves({ set: { "row-2": { edits: { name: "Sack" } } } })
      yield* stockSack
      const saved = yield* danaSaves({
        on: view.revision,
        set: { "row-2": { out: true } },
        over: { "row-2": [O.none(), O.some(mine)] }
      })
      expect(named(saved.decidedSince)).toEqual([["row-2", some({ edits: { name: "Sack" } })]])
      const now = yield* stored(["row-2"])
      expect(now).toEqual([some({ edits: { name: "Sack" } })])
    })
  )

  alone("the same with no item stocked since: named", () =>
    Effect.gen(function* () {
      const { view, danaSaves, marcusSaves, matched, stored } = yield* seededSacks
      yield* danaSaves({ on: view.revision, set: { "row-2": mine } })
      yield* matched("unitCost", "Net cost")
      yield* marcusSaves({ set: { "row-2": { edits: { name: "Sack" } } } })
      const saved = yield* danaSaves({
        on: view.revision,
        set: { "row-2": { out: true } },
        over: { "row-2": [O.none(), O.some(mine)] }
      })
      expect(named(saved.decidedSince)).toEqual([["row-2", some({ edits: { name: "Sack" } })]])
      const now = yield* stored(["row-2"])
      expect(now).toEqual([some({ edits: { name: "Sack" } })])
    })
  )

  alone("a Replace the match took back, its item taken back since: written over what the match left", () =>
    Effect.gen(function* () {
      const stock = yield* stockSack
      const { view, danaSaves, matched, stored } = yield* seededSacks
      yield* danaSaves({ on: view.revision, set: { "row-2": mine } })
      const match = yield* matched("unitCost", "Net cost")
      expect(A.map(match.takenBack, ({ field, kind, rows }) => [field, kind, rows])).toEqual([
        ["unitCost", "stored", ["row-2"]]
      ])
      yield* stock.takeBack
      const saved = yield* danaSaves({
        on: view.revision,
        set: { "row-2": { out: true } },
        over: { "row-2": [O.none(), O.some(mine)] }
      })
      expect(saved.decidedSince).toEqual([])
      const now = yield* stored(["row-2"])
      expect(now).toEqual([some({ out: true })])
    })
  )

  alone("the same with the item still there: written", () =>
    Effect.gen(function* () {
      yield* stockSack
      const { view, danaSaves, matched, stored } = yield* seededSacks
      yield* danaSaves({ on: view.revision, set: { "row-2": mine } })
      yield* matched("unitCost", "Net cost")
      const saved = yield* danaSaves({
        on: view.revision,
        set: { "row-2": { out: true } },
        over: { "row-2": [O.none(), O.some(mine)] }
      })
      expect(saved.decidedSince).toEqual([])
      const now = yield* stored(["row-2"])
      expect(now).toEqual([some({ out: true })])
    })
  )

  /** Row 2's Replace and row 3's accept taken back by a match of the cost; row 3's Replace stands. */
  const takenAndStanding = Effect.gen(function* () {
    yield* stockSack
    const seeded = yield* seededSacks
    yield* seeded.danaSaves({ on: seeded.view.revision, set: { "row-2": mine, "row-3": both } })
    yield* seeded.matched("unitCost", "Net cost")
    const left = yield* seeded.stored(["row-2", "row-3"])
    expect(left).toEqual([some({ edits: { name: "Sack" } }), some({ stored: "replace" })])
    return seeded
  })
  const waitedOver = (seeded: Effect.Success<typeof seededSacks>) =>
    seeded.danaSaves({
      on: seeded.view.revision,
      set: { "row-2": { out: true }, "row-3": { out: true } },
      over: { "row-2": [O.none(), O.some(mine)], "row-3": [O.none(), O.some(both)] }
    })

  alone("as each match recorded: the Replace taken and the one that stood are both what the match left", () =>
    Effect.gen(function* () {
      const seeded = yield* takenAndStanding
      const saved = yield* waitedOver(seeded)
      expect(saved.decidedSince).toEqual([])
      const now = yield* seeded.stored(["row-2", "row-3"])
      expect(now).toEqual([some({ out: true }), some({ out: true })])
    })
  )

  alone(
    "a match whose take-backs a confirm let go: both named, the one the match did take and the one that stood",
    () =>
      Effect.gen(function* () {
        const seeded = yield* takenAndStanding
        const { imports, params } = seeded
        const before = yield* imports.get({ params }).pipe(as(marcus))
        yield* imports
          .commit({ params, payload: { revision: before.revision, madeOn: {}, set: {}, clear: [] } })
          .pipe(as(marcus))
        yield* imports.reopen({ params }).pipe(as(marcus))
        const saved = yield* waitedOver(seeded)
        expect(named(saved.decidedSince)).toEqual([
          ["row-2", some({ edits: { name: "Sack" } })],
          ["row-3", some({ stored: "replace" })]
        ])
        const now = yield* seeded.stored(["row-2", "row-3"])
        expect(now).toEqual([some({ edits: { name: "Sack" } }), some({ stored: "replace" })])
      })
  )

  alone("a row past those a match's entry names by row is named, whatever the match did; one it names is written", () =>
    Effect.gen(function* () {
      const imports = yield* importsEndpoints
      // The rows the match takes back, then one it leaves standing: past the rows the entry names.
      const taken = A.makeBy(takenBackRowsNamed + 1, (index) => ({
        ...sackLine,
        sku: `CCC-${Str.padStart(4, "0")(`${index + 1}`)}`
      }))
      const lines = [...taken, { ...canvasLine, sku: "EEE-0001" }]
      const stockLines = A.map(lines, (line) => ({ ...line, "Net cost": "" }))
      const stocked = yield* stage(tableOf("many-stock.csv", stockLines)).pipe(as(marcus))
      yield* imports
        .commit({
          params: { id: stocked.id },
          payload: { revision: stocked.revision, madeOn: {}, set: {}, clear: [] }
        })
        .pipe(as(marcus))
      const view = yield* stage(tableOf("many.csv", lines)).pipe(as(marcus))
      const { danaSaves, marcusSaves, matched, stored } = people(imports, view.id)
      const standing = `row-${lines.length + 1}`
      const last = `row-${takenBackRowsNamed + 2}`
      const replaced = yield* marcusSaves({
        set: {
          ...R.fromEntries(A.map(taken, (_line, index) => [`row-${index + 2}`, { stored: "replace" }] as const)),
          [standing]: both
        }
      })
      const match = yield* matched("unitCost", "Net cost")
      const entry = A.findFirst(match.takenBack, (one) => one.kind === "stored")
      expect(O.map(entry, ({ count, rows }) => [count, rows.length, A.some(rows, (row) => row === last)])).toEqual(
        O.some([takenBackRowsNamed + 1, takenBackRowsNamed, false])
      )
      const saved = yield* danaSaves({
        on: replaced.revision,
        set: { "row-2": { out: true }, [last]: { out: true }, [standing]: { out: true } },
        over: {
          "row-2": [O.some({ stored: "replace" })],
          [last]: [O.some({ stored: "replace" })],
          [standing]: [O.some(both)]
        }
      })
      expect(named(saved.decidedSince)).toEqual([
        [last, O.none()],
        [standing, some({ stored: "replace" })]
      ])
      const now = yield* stored(["row-2", last, standing])
      expect(now).toEqual([some({ out: true }), some({}), some({ stored: "replace" })])
    })
  )
})

describe("what lands between a save's comparison and its write", () => {
  /** The endpoints on a store whose first saves find `between` landed just before them; `tries` counts them. */
  const windowed = Effect.fn("windowed")(function* (between: Effect.Effect<unknown>, times: number) {
    const inner = yield* ImportStore
    const tries = MutableRef.make(0)
    const store = ImportStore.of({
      ...inner,
      decide: Effect.fn("windowed.decide")(function* (...args: Parameters<ImportStore["Service"]["decide"]>) {
        if (MutableRef.updateAndGet(tries, (n) => n + 1) <= times) yield* between
        return yield* inner.decide(...args)
      })
    })
    const imports = yield* importsEndpoints.pipe(Effect.provideService(ImportStore, store))
    return { imports, tries }
  })
  const waiting = (on: number): Save => ({
    on,
    set: { "row-4": { edits: { name: "Rope" } } },
    over: { "row-4": [O.none()] }
  })

  layer(App)("is never written over, and never confirmed under it", (it) => {
    it.effect("a colleague's decision of the row: compared again, and named with theirs", () =>
      Effect.gen(function* () {
        const { view, params, marcusSaves, stored } = yield* seeded
        const { imports, tries } = yield* windowed(Effect.orDie(marcusSaves({ set: { "row-4": { out: true } } })), 1)
        const saved = yield* people(imports, params.id).danaSaves(waiting(view.revision))
        expect([MutableRef.get(tries), named(saved.decidedSince)]).toEqual([2, [["row-4", some({ out: true })]]])
        const now = yield* stored(["row-4"])
        expect(now).toEqual([some({ out: true })])
      })
    )

    it.effect("a colleague's decision of another row: compared again, and written", () =>
      Effect.gen(function* () {
        const { view, params, marcusSaves, stored } = yield* seeded
        const { imports, tries } = yield* windowed(Effect.orDie(marcusSaves({ set: { "row-5": { out: true } } })), 1)
        const saved = yield* people(imports, params.id).danaSaves(waiting(view.revision))
        expect([MutableRef.get(tries), saved.decidedSince]).toEqual([2, []])
        const now = yield* stored(["row-4", "row-5"])
        expect(now).toEqual([some({ edits: { name: "Rope" } }), some({ out: true })])
      })
    )

    it.effect(
      "a colleague's put-back of a row held a moment before: the answer is of one revision, and the row is written",
      () =>
        Effect.gen(function* () {
          const { view, params, marcusSaves, stored } = yield* seeded
          yield* marcusSaves({ set: { "row-4": { out: true } } })
          // Only held rows: there is nothing to write, and still the answer is not of a draft that moved on.
          const { imports, tries } = yield* windowed(Effect.orDie(marcusSaves({ clear: ["row-4"] })), 1)
          const saved = yield* people(imports, params.id).danaSaves(waiting(view.revision))
          expect([MutableRef.get(tries), saved.decidedSince]).toEqual([2, []])
          const now = yield* stored(["row-4"])
          expect(now).toEqual([some({ edits: { name: "Rope" } })])
        })
    )

    it.effect("a match: compared and judged again against the columns it left", () =>
      Effect.gen(function* () {
        const { params, marcusSaves, matched, stored } = yield* seeded
        const replaced = yield* marcusSaves({ set: { "row-2": { stored: "replace" } } })
        const { imports, tries } = yield* windowed(Effect.orDie(matched("sku", "Alt code")), 1)
        const saved = yield* people(imports, params.id).danaSaves({
          on: replaced.revision,
          set: { "row-2": { stored: "replace", edits: { name: "Crate" } } },
          over: { "row-2": [O.some({ stored: "replace" })] }
        })
        expect([MutableRef.get(tries), saved.decidedSince, saved.notApplied]).toEqual([
          2,
          [],
          [{ rowId: "row-2", field: "sku", kind: "stored" }]
        ])
        const now = yield* stored(["row-2"])
        expect(now).toEqual([some({ edits: { name: "Crate" } })])
      })
    )

    it.effect("a confirm: refused as any save of an import already confirmed is", () =>
      Effect.gen(function* () {
        const { imports: plain, view, params } = yield* seeded
        const confirmed = plain
          .commit({ params, payload: { revision: view.revision, madeOn: {}, set: {}, clear: [] } })
          .pipe(as(marcus))
        const { imports } = yield* windowed(Effect.orDie(confirmed), 1)
        const refused = yield* Effect.flip(people(imports, params.id).danaSaves(waiting(view.revision)))
        expect(S.is(AlreadyImported)(refused)).toBe(true)
      })
    )

    it.effect(
      "on every try: refused as busy after `draftTries`, with nothing written; without `over`, not at all",
      () =>
        Effect.gen(function* () {
          const { imports: plain, view, params, stored } = yield* seeded
          const flip = Effect.gen(function* () {
            const now = yield* plain.get({ params }).pipe(as(marcus))
            const out = O.isSome(R.get(now.decisions, "row-5"))
            yield* people(plain, params.id).marcusSaves(
              out ? { clear: ["row-5"] } : { set: { "row-5": { out: true } } }
            )
          }).pipe(Effect.orDie)
          const { imports, tries } = yield* windowed(flip, draftTries * 2)
          const refused = yield* Effect.flip(people(imports, params.id).danaSaves(waiting(view.revision)))
          expect([S.is(DraftBusy)(refused), MutableRef.get(tries)]).toEqual([true, draftTries])
          const now = yield* stored(["row-4"])
          expect(now).toEqual([O.none()])
          // A live press has nothing compared: a save that lands before it is no reason to try again.
          const { over: _over, ...live } = waiting(view.revision)
          const saved = yield* people(imports, params.id).danaSaves(live)
          expect([saved.changed, MutableRef.get(tries)]).toEqual([true, draftTries + 1])
        })
    )

    it.effect("overtaken on every try by the same person's other tab: the words do not say it was somebody else", () =>
      Effect.gen(function* () {
        const { imports: plain, view, params } = yield* seeded
        // Dana's other tab puts row 5 out and back, as herself, before each try of this one.
        const otherTab = Effect.gen(function* () {
          const now = yield* plain.get({ params }).pipe(as(dana))
          const out = O.isSome(R.get(now.decisions, "row-5"))
          yield* plain
            .decide({
              params,
              payload: request(
                out ? { on: now.revision, clear: ["row-5"] } : { on: now.revision, set: { "row-5": { out: true } } }
              )
            })
            .pipe(as(dana))
        }).pipe(Effect.orDie)
        const { imports } = yield* windowed(otherTab, draftTries)
        const refused = yield* Effect.flip(people(imports, params.id).danaSaves(waiting(view.revision)))
        expect(S.is(DraftBusy)(refused) ? refused.reason : refused).toEqual(
          "This import kept being changed (in another tab or by someone else) while your request was worked out, so nothing was written. Try again in a moment."
        )
      })
    )

    it.effect("the store itself answers `moved` for the revision it was compared at, an empty delta included", () =>
      Effect.gen(function* () {
        const { view, marcusSaves, stored } = yield* seeded
        const store = yield* ImportStore
        yield* marcusSaves({ set: { "row-5": { out: true } } })
        const found = yield* store.find(dana.organizationId, view.id)
        const draft = O.getOrThrow(found)
        const at = O.some(view.revision)
        const refused = yield* store.decide(
          dana,
          draft,
          { set: flags({ "row-4": { out: true } }), clear: [] },
          undefined,
          at
        )
        const nothing = yield* store.decide(dana, draft, { set: {}, clear: [] }, undefined, at)
        expect([refused, nothing]).toEqual([decisionsMoved, decisionsMoved])
        const now = yield* stored(["row-4"])
        expect(now).toEqual([O.none()])
      })
    )
  })

  layer(App)("a take-back of the import itself", (it) => {
    it.effect(
      "between the comparison and the write: compared again, and judged by what the match took back, not by the items it changed",
      () =>
        Effect.gen(function* () {
          yield* stockSack
          const { imports: plain, params, danaSaves, matched, stored } = yield* seededSacks
          // Confirmed (the burlap sack is created), then opened again: a take-back now has something to take back.
          const staged = yield* plain.get({ params }).pipe(as(marcus))
          yield* plain
            .commit({ params, payload: { revision: staged.revision, madeOn: {}, set: {}, clear: [] } })
            .pipe(as(marcus))
          const open = yield* plain.reopen({ params }).pipe(as(marcus))
          yield* danaSaves({ on: open.revision, set: { "row-2": mine } })
          yield* matched("unitCost", "Net cost")
          const confirms = (yield* plain.get({ params }).pipe(as(marcus))).takeBack.confirms
          const takeBack = Effect.orDie(plain.takeBack({ params, payload: { confirms } }).pipe(as(marcus)))
          const { imports, tries } = yield* windowed(takeBack, 1)
          const saved = yield* people(imports, params.id).danaSaves({
            on: open.revision,
            set: { "row-2": { out: true } },
            over: { "row-2": [O.none(), O.some(mine)] }
          })
          const after = yield* plain.get({ params }).pipe(as(marcus))
          expect([MutableRef.get(tries), saved.decidedSince, after.createdRows, after.status]).toEqual([
            2,
            [],
            [],
            "open"
          ])
          const now = yield* stored(["row-2"])
          expect(now).toEqual([some({ out: true })])
        })
    )
  })
})

describe("what a save with rows that waited costs", () => {
  layer(App)("the file's review is asked the same however many decisions a row names", (it) => {
    it.effect("one named decision a row or eight, across a match of the cost: the same reviews, a few per save", () =>
      Effect.gen(function* () {
        const plain = yield* importsEndpoints
        const rows = 30
        const lines = A.makeBy(rows, (index) => ({ ...sackLine, sku: `CCC-${Str.padStart(4, "0")(`${index + 1}`)}` }))
        const stocking = yield* stage(
          tableOf(
            "stock.csv",
            A.map(lines, (line) => ({ ...line, "Net cost": "" }))
          )
        ).pipe(as(marcus))
        yield* plain
          .commit({
            params: { id: stocking.id },
            payload: { revision: stocking.revision, madeOn: {}, set: {}, clear: [] }
          })
          .pipe(as(marcus))
        const view = yield* stage(tableOf("costed.csv", lines)).pipe(as(marcus))
        const ids = A.makeBy(rows, (index) => `row-${index + 2}`)
        const replaced = yield* people(plain, view.id).marcusSaves({
          set: R.fromEntries(A.map(ids, (id) => [id, { stored: "replace" }] as const))
        })
        yield* people(plain, view.id).matched("unitCost", "Net cost")
        // What every decision named below is as the match left it: each row's name, and nothing of the cost.
        yield* people(plain, view.id).marcusSaves({
          set: R.fromEntries(A.map(ids, (id) => [id, { edits: { name: "Sack" } }] as const))
        })
        // Each row of the file the review reads is one call: the reviews a save runs, counted in rows.
        const read = MutableRef.make(0)
        const counting: ItemsOfRowShape = (input) => {
          MutableRef.update(read, (n) => n + 1)
          return itemsOfRow(input)
        }
        const imports = yield* importsEndpoints.pipe(Effect.provideService(ItemsOfRow, counting))
        // Eight decisions a row may name, each one the match leaves as the row's name alone.
        const variants = A.flatMap(["replace", "keep"] as const, (stored) =>
          A.flatMap([[], ["unitCost"]], (accepted) =>
            A.map([[], ["unitCost"]], (reverted): RowDecisionFlags => ({
              stored,
              accepted,
              reverted,
              edits: { name: "Sack" }
            }))
          )
        )
        // The save's own Replaces, made before the match, ask the review; what the rows that waited name does not.
        const reviewsOf = Effect.fnUntraced(function* (named: number) {
          MutableRef.set(read, 0)
          yield* people(imports, view.id).danaSaves({
            on: replaced.revision,
            set: R.fromEntries(A.map(ids, (id) => [id, { stored: "replace", edits: { name: "Sack" } }] as const)),
            over: R.fromEntries(A.map(ids, (id) => [id, A.map(A.take(variants, named), O.some)] as const))
          })
          return MutableRef.get(read) / rows
        })
        const one = yield* reviewsOf(1)
        const all = yield* reviewsOf(variants.length)
        expect([all, one <= 6, one > 0]).toEqual([one, true, true])
      })
    )
  })
})

describe("who may send a save with rows that waited", () => {
  layer(App)("as any save", (it) => {
    it.effect("a viewer is refused; another organization finds no import, and is told nothing of what is stored", () =>
      Effect.gen(function* () {
        const { imports, view, params, marcusSaves } = yield* seeded
        yield* marcusSaves({ set: { "row-4": { out: true } } })
        const payload = request({
          on: view.revision,
          set: { "row-4": { edits: { name: "Rope" } } },
          over: { "row-4": [O.none()] }
        })
        const viewer = yield* Effect.flip(imports.decide({ params, payload }).pipe(as(priya)))
        const stranger = yield* Effect.flip(imports.decide({ params, payload }).pipe(as(elena)))
        expect([S.is(Forbidden)(viewer), S.is(ImportNotFound)(stranger)]).toEqual([true, true])
      })
    )
  })
})
