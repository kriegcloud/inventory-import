// What a re-match of a column takes back besides accepts (Benjamin, 2026-11-20): a Replace or Keep-stored and a
// keep-one-of-two across a SKU re-match, a Replace or Keep-stored across another re-match only where the row's
// comparison changed, an undone fix across its field's re-match, and a field moved off its column by another field's
// match. Each rule at a save (named in `notApplied`), at a confirm (refused whole with `AcceptsTakenBack`) and at the
// match itself (a stored decision dropped in its write), over the in-memory twins. The same scenarios run on D1 in the
// app's Rematch slow test.
import { describe, expect, it, layer } from "@effect/vitest"
import { ColumnMove, type MappingChoice } from "@inventory/catalog-contract/Mapping"
import { decisionFromFlags, type RowDecisionFlags } from "@inventory/catalog-contract/Decision"
import { AcceptsTakenBack } from "@inventory/catalog-contract/ImportRejection"
import type { StagedTable } from "@inventory/catalog-contract/Staged"
import type { ImportView } from "@inventory/catalog-contract/Import"
import { importsEndpoints } from "@inventory/catalog-model/ImportsHandler"
import { itemsOfRow, review } from "@inventory/catalog-model/Review"
import { catalogMemory } from "@inventory/catalog-model/Memory"
import {
  columnAt,
  columnsOf,
  comparisonQuestions,
  comparisonsChanged,
  heldAtMatch,
  movesOfMatch,
  withoutStaleDecisions
} from "@inventory/catalog-model/Rematch"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as SecureRandom from "effect/crypto/SecureRandom"
import * as S from "effect/Schema"
import { as, dana, marcus, stage } from "./support.ts"

const App = Layer.mergeAll(catalogMemory(), SecureRandom.layerWebCrypto)

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
type Line = Partial<Record<(typeof headings)[number], string>>
const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"]
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

/** The two items stocked, then the reviewed file staged twice: one import to save and confirm on, one to match on. */
const seeded = Effect.gen(function* () {
  const imports = yield* importsEndpoints
  const first = yield* stage(stocked).pipe(as(marcus))
  yield* imports
    .commit({ params: { id: first.id }, payload: { revision: first.revision, madeOn: {}, set: {}, clear: [] } })
    .pipe(as(marcus))
  const saving = yield* stage(reviewed).pipe(as(marcus))
  const matching = yield* stage(reviewed).pipe(as(marcus))
  return { imports, saving, matching }
})

const flags = (set: Readonly<Record<string, RowDecisionFlags>>) => R.map(set, decisionFromFlags)

/**
 * One rule end to end on the twins: `rematch` on the first import, a save of `set` made before it (what it names, and
 * the decisions stored after), a confirm carrying the same (refused, naming the same, nothing imported); then on the
 * second import `set` saved first and `rematch` after (the decisions stored after the match).
 */
const scenario = Effect.fn("scenario")(function* (input: {
  readonly rematch: ReadonlyArray<{ readonly field: MappingChoice["field"]; readonly column: number }>
  readonly set: Readonly<Record<string, RowDecisionFlags>>
}) {
  const { imports, saving, matching } = yield* seeded
  const set = flags(input.set)
  const madeOn = R.map(set, () => saving.revision)
  const rematch = (id: typeof saving.id) =>
    Effect.forEach(
      input.rematch,
      (choice) =>
        imports
          .match({ params: { id }, payload: { field: choice.field, column: O.some(choice.column) } })
          .pipe(as(dana)),
      { concurrency: 1 }
    )
  yield* rematch(saving.id)
  const saved = yield* imports
    .decide({ params: { id: saving.id }, payload: { madeOn, set, clear: [] } })
    .pipe(as(marcus))
  const afterSave = yield* imports.get({ params: { id: saving.id } }).pipe(as(marcus))
  const refused = yield* Effect.flip(
    imports
      .commit({ params: { id: saving.id }, payload: { revision: afterSave.revision, madeOn, set, clear: [] } })
      .pipe(as(marcus))
  )
  const stillOpen = yield* imports.get({ params: { id: saving.id } }).pipe(as(marcus))

  yield* imports
    .decide({ params: { id: matching.id }, payload: { madeOn: R.map(set, () => matching.revision), set, clear: [] } })
    .pipe(as(marcus))
  yield* rematch(matching.id)
  const afterMatch = yield* imports.get({ params: { id: matching.id } }).pipe(as(marcus))
  return {
    notApplied: saved.notApplied,
    saved: afterSave.decisions,
    refused: S.is(AcceptsTakenBack)(refused) ? refused.accepts : [],
    status: stillOpen.status,
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
  const row = A.findFirst(drawn.rows, (candidate) => candidate.id === "row-6")
  return O.map(row, (found) => ({
    reads: found.values.uom,
    fix: O.map(
      A.findFirst(found.proposals, (proposal) => proposal.field === "uom"),
      (proposal) => proposal.to
    )
  }))
}

describe("a match's earlier tries, held", () => {
  const replace = decisionFromFlags({ stored: "replace" })
  const question = { rowId: "row-3", field: "unitCost" as const, made: 4, then: replace, now: replace }
  const choice = (column: number): MappingChoice => ({ field: "unitCost", column, by: "person", at: 5 })
  const firstTry = heldAtMatch({
    earlier: O.none(),
    choices: [choice(7)],
    moves: [],
    questions: [question],
    changed: []
  })

  it("hold down a take-back a later try finds while the columns are the same (an item changed in between)", () => {
    const later = heldAtMatch({
      earlier: O.some(firstTry.held),
      choices: [choice(7)],
      moves: [],
      questions: [question],
      changed: [{ rowId: "row-3", field: "unitCost" }]
    })
    expect(later.changed).toEqual([])
  })

  it("never hold down a take-back once another person's match changed the columns between two tries", () => {
    const later = heldAtMatch({
      earlier: O.some(firstTry.held),
      choices: [choice(8)],
      moves: [],
      questions: [question],
      changed: [{ rowId: "row-3", field: "unitCost" }]
    })
    expect(later.changed).toEqual([{ rowId: "row-3", field: "unitCost" }])
  })
})

describe("the column a field read at a past revision, and when it moved", () => {
  const { rows: _rows, ...staged } = reviewed
  it("a field moved off its column by another field's match moves too, stamped with the same revision", () => {
    // Name takes the column headed "uom": the unit has no other heading, so it reads no column from then on.
    const after: ReadonlyArray<MappingChoice> = [{ field: "name", column: column("uom"), by: "person", at: 4 }]
    expect(movesOfMatch({ head: staged, before: [], after, field: "name", at: 4 })).toEqual([
      { field: "name", at: 4, was: column("name"), column: column("uom") },
      { field: "uom", at: 4, was: column("uom"), column: null }
    ])
  })

  it("is exact after several re-matches: the `was` of the first move after the revision, else the column now", () => {
    const choices: ReadonlyArray<MappingChoice> = [
      { field: "unitCost", column: column("Net cost"), by: "person", at: 7 }
    ]
    const moves: ReadonlyArray<ColumnMove> = [
      { field: "unitCost", at: 4, was: column("unit_cost"), column: column("List cost") },
      { field: "unitCost", at: 7, was: column("List cost"), column: column("Net cost") }
    ]
    const at = columnAt({ choices, moves, now: columnsOf({ head: staged, choices }) })
    expect([at("unitCost", 3), at("unitCost", 4), at("unitCost", 6), at("unitCost", 7), at("name", 0)]).toEqual([
      O.some(column("unit_cost")),
      O.some(column("List cost")),
      O.some(column("List cost")),
      O.some(column("Net cost")),
      O.some(column("name"))
    ])
    // A choice made after the revision with no move kept (matched before moves were kept): not known.
    expect(columnAt({ choices, moves: [], now: () => 0 })("unitCost", 3)).toEqual(O.none())
  })

  it.prop("ColumnMove generates only valid values", [Arbitrary.schema(ColumnMove)], ([move]) => {
    expect(S.is(ColumnMove)(move)).toBe(true)
  })
})

describe("accepts made before their field's column was matched again, as the save and the confirm judge them", () => {
  // Unit cost matched by hand at 12, the unit at 3; each match kept its move, as the stores write them.
  const choices: ReadonlyArray<MappingChoice> = [
    { field: "unitCost", column: 7, by: "person", at: 12 },
    { field: "uom", column: 4, by: "person", at: 3 }
  ]
  const moves: ReadonlyArray<ColumnMove> = [
    { field: "uom", at: 3, was: 4, column: 4 },
    { field: "unitCost", at: 12, was: 5, column: 7 }
  ]
  const set = flags({
    "row-55": { accepted: ["unitCost", "uom"], edits: { name: "Steel Tube 1in" } },
    "row-18": { reverted: ["name"] }
  })
  const judge = (madeOn: Readonly<Record<string, number>>, decisions = set) =>
    withoutStaleDecisions({ choices, moves, madeOn, set: decisions, changed: [] })

  it("are taken out and named; the rest of the decision, and every other row, is applied", () => {
    const made = judge({ "row-55": 11, "row-18": 11 })
    expect(made.notApplied).toEqual([{ rowId: "row-55", field: "unitCost", kind: "accept" }])
    expect(made.applied).toEqual({
      "row-55": decisionFromFlags({ accepted: ["uom"], edits: { name: "Steel Tube 1in" } }),
      "row-18": set["row-18"]
    })
  })

  it("are applied when the row was decided on the revision that has the match, or a later one", () => {
    expect(judge({ "row-55": 12, "row-18": 12 })).toEqual({ applied: set, notApplied: [] })
  })

  it("names every accept of every field matched since, on a row decided before any match", () => {
    expect(judge({ "row-55": 2, "row-18": 2 }).notApplied).toEqual([
      { rowId: "row-55", field: "unitCost", kind: "accept" },
      { rowId: "row-55", field: "uom", kind: "accept" }
    ])
  })

  it("are judged row by row: an old row never makes a newer row's accept stale, and a row named on no revision counts as made on 0", () => {
    const three = flags({
      "row-55": { accepted: ["unitCost"] },
      "row-9": { accepted: ["unitCost"] },
      "row-3": { accepted: ["unitCost"] }
    })
    // Row 9 waited from revision 10, before unit cost was matched again at 12; row 55 was accepted on 12.
    expect(judge({ "row-55": 12, "row-9": 10 }, three).notApplied).toEqual([
      { rowId: "row-9", field: "unitCost", kind: "accept" },
      { rowId: "row-3", field: "unitCost", kind: "accept" }
    ])
  })

  it("are stale too when their field only moved off its column (another field took it), with no choice of its own", () => {
    const made = withoutStaleDecisions({
      choices: [{ field: "name", column: 4, by: "person", at: 6 }],
      moves: [
        { field: "name", at: 6, was: 1, column: 4 },
        { field: "uom", at: 6, was: 4, column: null }
      ],
      madeOn: { "row-55": 5 },
      set: flags({ "row-55": { accepted: ["uom"] } }),
      changed: []
    })
    expect(made.notApplied).toEqual([{ rowId: "row-55", field: "uom", kind: "accept" }])
  })
})

describe("each kind of decision judged on its row's revision", () => {
  const choices: ReadonlyArray<MappingChoice> = [{ field: "sku", column: 7, by: "person", at: 5 }]
  const set = flags({
    "row-2": { stored: "replace", accepted: ["name"], reverted: ["uom"] },
    "row-4": { kept: true },
    "row-5": { out: true, kept: true }
  })
  it("after a SKU re-match: Replace, keep-one-of-two taken back; the rest stands; a newer row stands whole", () => {
    const made = withoutStaleDecisions({
      choices,
      moves: [],
      madeOn: { "row-2": 4, "row-4": 4, "row-5": 5 },
      set,
      changed: []
    })
    expect(made.notApplied).toEqual([
      { rowId: "row-2", field: "sku", kind: "stored" },
      { rowId: "row-4", field: "sku", kind: "twin" }
    ])
    expect(made.applied).toEqual({
      "row-2": decisionFromFlags({ accepted: ["name"], reverted: ["uom"] }),
      "row-4": decisionFromFlags({}),
      "row-5": set["row-5"]
    })
  })

  it("after another field's re-match: a Replace only where `changed` names its row, with that field", () => {
    const moved: ReadonlyArray<ColumnMove> = [{ field: "unitCost", at: 5, was: 5, column: 8 }]
    const both = flags({ "row-2": { stored: "replace" }, "row-3": { stored: "keep" } })
    const made = withoutStaleDecisions({
      choices: [],
      moves: moved,
      madeOn: { "row-2": 4, "row-3": 4 },
      set: both,
      changed: [{ rowId: "row-3", field: "unitCost" }]
    })
    expect(made.notApplied).toEqual([{ rowId: "row-3", field: "unitCost", kind: "stored" }])
    expect(made.applied).toEqual({ "row-2": both["row-2"], "row-3": decisionFromFlags({}) })
  })
})

describe("a Replace or Keep-stored across a re-match of the SKU column", () => {
  layer(App)("Server refuses, says so", (it) => {
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
        expect([done.notApplied, done.refused, done.status]).toEqual([named, named, "open"])
        const undecided = [O.some(decisionFromFlags({})), O.some(decisionFromFlags({}))]
        expect(decided(done.saved, ["row-2", "row-3"])).toEqual(undecided)
        expect(decided(done.matched, ["row-2", "row-3"])).toEqual(undecided)
      })
    )
  })
})

describe("a keep-one-of-two across a re-match of the SKU column", () => {
  layer(App)("Server refuses, says so", (it) => {
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
        expect([done.notApplied, done.refused, done.status]).toEqual([named, named, "open"])
        const after = [O.some(decisionFromFlags({})), O.some(decisionFromFlags({ out: true }))]
        expect(decided(done.saved, ["row-4", "row-5"])).toEqual(after)
        expect(decided(done.matched, ["row-4", "row-5"])).toEqual(after)
      })
    )
  })
})

describe("a Replace or Keep-stored across a re-match of another column", () => {
  layer(App)("Refuse if it changes the row", (it) => {
    it.effect("is taken back only where the row's comparison with its stored item changed; the other stands", () =>
      Effect.gen(function* () {
        const done = yield* scenario({
          rematch: [{ field: "unitCost", column: column("List cost") }],
          set: { "row-2": { stored: "replace" }, "row-3": { stored: "replace" } }
        })
        const named = [{ rowId: "row-3", field: "unitCost", kind: "stored" }]
        expect([done.notApplied, done.refused, done.status]).toEqual([named, named, "open"])
        const after = [O.some(decisionFromFlags({ stored: "replace" })), O.some(decisionFromFlags({}))]
        expect(decided(done.saved, ["row-2", "row-3"])).toEqual(after)
        expect(decided(done.matched, ["row-2", "row-3"])).toEqual(after)
      })
    )

    it.effect("is judged against the column the field read on the row's revision, after several re-matches", () =>
      Effect.gen(function* () {
        const { imports, saving } = yield* seeded
        const params = { id: saving.id }
        const match = (heading: (typeof headings)[number]) =>
          imports.match({ params, payload: { field: "unitCost", column: O.some(column(heading)) } }).pipe(as(dana))
        const once = yield* match("List cost")
        yield* match("Net cost")
        const replace = flags({ "row-3": { stored: "replace" } })
        // Made while the cost read "unit_cost" (9.00, as "Net cost" reads): the comparison is the same, it stands.
        const before = yield* imports
          .decide({ params, payload: { madeOn: { "row-3": saving.revision }, set: replace, clear: [] } })
          .pipe(as(marcus))
        // Made while it read "List cost" (3, the stored cost): the comparison changed, it is taken back.
        const between = yield* imports
          .decide({ params, payload: { madeOn: { "row-3": once.revision }, set: replace, clear: [] } })
          .pipe(as(marcus))
        expect([before.notApplied, between.notApplied]).toEqual([
          [],
          [{ rowId: "row-3", field: "unitCost", kind: "stored" }]
        ])
      })
    )

    it.effect(
      "is judged on its own field only: an accept or undone fix of a second field matched again changes nothing of it",
      () =>
        Effect.gen(function* () {
          const imports = yield* importsEndpoints
          const first = yield* stage(stocked).pipe(as(marcus))
          yield* imports
            .commit({ params: { id: first.id }, payload: { revision: first.revision, madeOn: {}, set: {}, clear: [] } })
            .pipe(as(marcus))
          // Each row's cost reads the same under "Net cost" as under "unit_cost", and its unit "EA" under "uom" as "ea"
          // under "Pack unit", which a rule writes in capitals: neither re-match changes how a row compares. Row 2
          // accepted the unit's fix, row 3 undid it, both with a Replace. Each re-match takes that accept or undo back
          // on both sides, so row 3 kept as "ea" against the stored "EA" on one side only is not a change of the cost.
          const table = tableOf("two-moves.csv", [
            { ...item, sku: "AAA-0001", name: "Oak Crate", unit_cost: "12.50", "Net cost": "12.50", "Pack unit": "ea" },
            { ...item, sku: "AAA-0002", name: "Steel Bolt", unit_cost: "3", "Net cost": "3", "Pack unit": "ea" }
          ])
          const view = yield* stage(table).pipe(as(marcus))
          const set = flags({
            "row-2": { stored: "replace", accepted: ["uom"] },
            "row-3": { stored: "replace", reverted: ["uom"] }
          })
          // Both fields matched again after the rows were decided on revision 1.
          const choices: ReadonlyArray<MappingChoice> = [
            { field: "unitCost", column: column("Net cost"), by: "person", at: 2 },
            { field: "uom", column: column("Pack unit"), by: "person", at: 3 }
          ]
          const moves = [
            { field: "unitCost" as const, at: 2, was: column("unit_cost"), column: column("Net cost") },
            { field: "uom" as const, at: 3, was: column("uom"), column: column("Pack unit") }
          ]
          const madeOn = { "row-2": 1, "row-3": 1 }
          const changed = comparisonsChanged({
            table,
            choices,
            moves,
            storedItems: view.storedItems,
            createdIds: [],
            suggestions: view.suggestions,
            itemsOf: itemsOfRow,
            questions: comparisonQuestions({ choices, moves, madeOn, set })
          })
          // Both Replaces stand: no re-match changed how either row compares with its stored item.
          expect(changed).toEqual([])
        })
    )
  })
})

describe("an undone fix across a re-match of its field's column", () => {
  layer(App)("Server refuses, says so", (it) => {
    it.effect(
      "is named and not applied by a save, refuses a confirm, and is dropped by the match; the row shows the new value's fix",
      () =>
        Effect.gen(function* () {
          // The unit is matched to "Pack unit", where row 6 says "kg": a new value, with its own fix (KG).
          const done = yield* scenario({
            rematch: [{ field: "uom", column: column("Pack unit") }],
            set: { "row-6": { reverted: ["uom"], edits: { name: "Hemp Rope 10m" } } }
          })
          const named = [{ rowId: "row-6", field: "uom", kind: "undo" }]
          expect([done.notApplied, done.refused, done.status]).toEqual([named, named, "open"])
          const after = [O.some(decisionFromFlags({ edits: { name: "Hemp Rope 10m" } }))]
          expect(decided(done.saved, ["row-6"])).toEqual(after)
          expect(decided(done.matched, ["row-6"])).toEqual(after)
          // The fix the person undid was for "each"; the row now reads "kg", and its own fix is open in force.
          expect(unitOfRow6(done.matchedView)).toEqual(O.some({ reads: "KG", fix: O.some("KG") }))
        })
    )
  })
})

describe("a field moved off its column when a person gives that column to another field", () => {
  layer(App)("is matched again too", (it) => {
    it.effect(
      "its accepts and undone fixes made before are named, refuse a confirm, and are dropped by the match",
      () =>
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
          expect([done.notApplied, done.refused, done.status]).toEqual([named, named, "open"])
          const after = [O.some(decisionFromFlags({})), O.some(decisionFromFlags({}))]
          expect(decided(done.saved, ["row-6", "row-2"])).toEqual(after)
          expect(decided(done.matched, ["row-6", "row-2"])).toEqual(after)
        })
    )
  })
})
