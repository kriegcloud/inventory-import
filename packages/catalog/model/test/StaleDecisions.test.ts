// What a re-match of a column takes back besides accepts (Benjamin, 2026-11-20): a Replace or Keep-stored and a
// keep-one-of-two across a SKU re-match, a Replace or Keep-stored across another re-match only where the row's
// comparison changed, an undone fix across its field's re-match, and a field moved off its column by another field's
// match; and what a match by hand to the column the field already reads takes back: nothing (Benjamin, 2026-11-21, "Only
// when it changes"). Each rule at a save (named in `notApplied`), at a confirm (refused whole with `AcceptsTakenBack`) and at the
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
import { catalogMemory, CatalogMemoryRef } from "@inventory/catalog-model/Memory"
import {
  columnAt,
  columnsOf,
  comparisonQuestions,
  comparisonsChanged,
  heldToTries,
  movesOfMatch,
  withoutStaleDecisions
} from "@inventory/catalog-model/Rematch"
import { decisionsItemsChanged, ImportStore } from "@inventory/catalog-model/ImportStore"
import { SuggestionStore } from "@inventory/catalog-model/SuggestionStore"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as MutableRef from "effect/MutableRef"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Ref from "effect/Ref"
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

const flags = (set: Readonly<Record<string, RowDecisionFlags.Encoded>>) => R.map(set, decisionFromFlags)

/**
 * One rule end to end on the twins: `rematch` on the first import, a save of `set` made before it (what it names, and
 * the decisions stored after), a confirm carrying the same (refused, naming the same, nothing imported); then on the
 * second import `set` saved first and `rematch` after (the decisions stored after the match).
 */
const scenario = Effect.fn("scenario")(function* (input: {
  readonly rematch: ReadonlyArray<{ readonly field: MappingChoice["field"]; readonly column: number }>
  readonly set: Readonly<Record<string, RowDecisionFlags.Encoded>>
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
    .decide({ params: { id: saving.id }, payload: { over: {}, madeOn, set, clear: [] } })
    .pipe(as(marcus))
  const afterSave = yield* imports.get({ params: { id: saving.id } }).pipe(as(marcus))
  const refused = yield* Effect.flip(
    imports
      .commit({ params: { id: saving.id }, payload: { revision: afterSave.revision, madeOn, set, clear: [] } })
      .pipe(as(marcus))
  )
  const stillOpen = yield* imports.get({ params: { id: saving.id } }).pipe(as(marcus))

  yield* imports
    .decide({
      params: { id: matching.id },
      payload: { over: {}, madeOn: R.map(set, () => matching.revision), set, clear: [] }
    })
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

describe("a request's earlier tries, held", () => {
  const replace = decisionFromFlags({ stored: "replace" })
  const question = {
    rowId: "row-3",
    fields: [{ field: "unitCost" as const, made: 4 }],
    decided: 3,
    then: replace,
    now: replace
  }
  const { rows: _rows, ...head } = reviewed
  const net = column("Net cost")
  const choice = (index: number, at: number): MappingChoice => ({
    field: "unitCost",
    column: O.some(index),
    by: "person",
    at
  })
  const move = (was: number, index: number, at: number): ColumnMove => ({
    field: "unitCost",
    at,
    was: O.some(was),
    column: O.some(index),
    knownFrom: O.none()
  })
  // A match of unit cost to "Net cost", asked of a draft at revision 4.
  const firstTry = heldToTries({
    earlier: O.none(),
    head,
    choices: [choice(net, 5)],
    moves: [move(column("unit_cost"), net, 5)],
    questions: [question],
    changed: []
  })
  const later = (asked: {
    readonly choices: ReadonlyArray<MappingChoice>
    readonly moves: ReadonlyArray<ColumnMove>
    readonly made: number
    readonly decided?: number
  }) =>
    heldToTries({
      earlier: O.some(firstTry.held),
      head,
      choices: asked.choices,
      moves: asked.moves,
      questions: [
        { ...question, fields: [{ field: "unitCost", made: asked.made }], decided: asked.decided ?? question.decided }
      ],
      changed: [{ rowId: "row-3", field: "unitCost" }]
    }).changed

  it("hold down a take-back a later try finds while the columns are the same (an item changed in between)", () => {
    expect(later({ choices: [choice(net, 5)], moves: [move(column("unit_cost"), net, 5)], made: 4 })).toEqual([])
  })

  it("never hold down a decision made again in between, even to the same choice: it takes the later try's answer", () => {
    expect(
      later({ choices: [choice(net, 7)], moves: [move(column("unit_cost"), net, 7)], made: 6, decided: 6 })
    ).toEqual([{ rowId: "row-3", field: "unitCost" }])
  })

  it("hold it down across a save on another row, which moves the revision the match is stamped with and no column", () => {
    expect(later({ choices: [choice(net, 6)], moves: [move(column("unit_cost"), net, 6)], made: 5 })).toEqual([])
  })

  it("hold it down across another person's pick of the column a field already reads, which changes none", () => {
    const pinned: MappingChoice = { field: "name", column: O.some(column("name")), by: "person", at: 0 }
    expect(later({ choices: [pinned, choice(net, 6)], moves: [move(column("unit_cost"), net, 6)], made: 5 })).toEqual(
      []
    )
  })

  it("never hold down a take-back once another person's match changed the columns between two tries", () => {
    const list = column("List cost")
    expect(
      later({
        choices: [choice(net, 6)],
        moves: [move(column("unit_cost"), list, 5), move(list, net, 6)],
        made: 5
      })
    ).toEqual([{ rowId: "row-3", field: "unitCost" }])
    // A field that only reads another column (no move of this draft's says so) starts them afresh too.
    expect(later({ choices: [choice(list, 6)], moves: [move(column("unit_cost"), net, 6)], made: 5 })).toEqual([
      { rowId: "row-3", field: "unitCost" }
    ])
  })
})

describe("the column a field read at a past revision, and when it moved", () => {
  const { rows: _rows, ...staged } = reviewed
  it("a field moved off its column by another field's match moves too, stamped with the same revision", () => {
    // Name takes the column headed "uom": the unit has no other heading, so it reads no column from then on.
    const after: ReadonlyArray<MappingChoice> = [{ field: "name", column: O.some(column("uom")), by: "person", at: 4 }]
    expect(movesOfMatch({ head: staged, before: [], after, kept: [], at: 4 })).toEqual([
      { field: "name", at: 4, was: O.some(column("name")), column: O.some(column("uom")), knownFrom: O.none() },
      { field: "uom", at: 4, was: O.some(column("uom")), column: O.none(), knownFrom: O.none() }
    ])
  })

  it("a field matched by hand to the column it already reads does not move", () => {
    const after: ReadonlyArray<MappingChoice> = [{ field: "name", column: O.some(column("name")), by: "person", at: 4 }]
    expect(movesOfMatch({ head: staged, before: [], after, kept: [], at: 4 })).toEqual([])
  })

  it("the first move of a field matched before moves were kept says from which revision its `was` is known", () => {
    const before: ReadonlyArray<MappingChoice> = [
      { field: "unitCost", column: O.some(column("List cost")), by: "person", at: 4 }
    ]
    const choices: ReadonlyArray<MappingChoice> = [
      { field: "unitCost", column: O.some(column("Net cost")), by: "person", at: 9 }
    ]
    const moves = movesOfMatch({ head: staged, before, after: choices, kept: [], at: 9 })
    expect(moves).toEqual([
      {
        field: "unitCost",
        at: 9,
        was: O.some(column("List cost")),
        column: O.some(column("Net cost")),
        knownFrom: O.some(4)
      }
    ])
    const at = columnAt({ choices, moves, now: columnsOf({ head: staged, choices }) })
    // On 3 it read a column nobody kept; from 4 on "List cost", and from 9 on "Net cost".
    expect([at("unitCost", 3), at("unitCost", 4), at("unitCost", 8), at("unitCost", 9)]).toEqual([
      O.none(),
      O.some(O.some(column("List cost"))),
      O.some(O.some(column("List cost"))),
      O.some(O.some(column("Net cost")))
    ])
    // The next one is known as any move is.
    const next: ReadonlyArray<MappingChoice> = [
      { field: "unitCost", column: O.some(column("unit_cost")), by: "person", at: 11 }
    ]
    expect(movesOfMatch({ head: staged, before: choices, after: next, kept: moves, at: 11 })).toEqual([
      {
        field: "unitCost",
        at: 11,
        was: O.some(column("Net cost")),
        column: O.some(column("unit_cost")),
        knownFrom: O.none()
      }
    ])
  })

  it("is exact after several re-matches: the `was` of the first move after the revision, else the column now", () => {
    const choices: ReadonlyArray<MappingChoice> = [
      { field: "unitCost", column: O.some(column("Net cost")), by: "person", at: 7 }
    ]
    const moves: ReadonlyArray<ColumnMove> = [
      {
        field: "unitCost",
        at: 4,
        was: O.some(column("unit_cost")),
        column: O.some(column("List cost")),
        knownFrom: O.none()
      },
      {
        field: "unitCost",
        at: 7,
        was: O.some(column("List cost")),
        column: O.some(column("Net cost")),
        knownFrom: O.none()
      }
    ]
    const at = columnAt({ choices, moves, now: columnsOf({ head: staged, choices }) })
    expect([at("unitCost", 3), at("unitCost", 4), at("unitCost", 6), at("unitCost", 7), at("name", 0)]).toEqual([
      O.some(O.some(column("unit_cost"))),
      O.some(O.some(column("List cost"))),
      O.some(O.some(column("List cost"))),
      O.some(O.some(column("Net cost"))),
      O.some(O.some(column("name")))
    ])
    // A choice made after the revision with no move kept (matched before moves were kept): not known.
    expect(columnAt({ choices, moves: [], now: () => O.some(0) })("unitCost", 3)).toEqual(O.none())
  })

  it.prop("ColumnMove generates only valid values", [Arbitrary.schema(ColumnMove)], ([move]) => {
    expect(S.is(ColumnMove)(move)).toBe(true)
  })
})

describe("accepts made before their field's column was matched again, as the save and the confirm judge them", () => {
  // Unit cost matched by hand at 12, the unit at 3; each match kept its move, as the stores write them.
  const choices: ReadonlyArray<MappingChoice> = [
    { field: "unitCost", column: O.some(7), by: "person", at: 12 },
    { field: "uom", column: O.some(4), by: "person", at: 3 }
  ]
  const moves: ReadonlyArray<ColumnMove> = [
    { field: "uom", at: 3, was: O.some(10), column: O.some(4), knownFrom: O.none() },
    { field: "unitCost", at: 12, was: O.some(5), column: O.some(7), knownFrom: O.none() }
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
      choices: [{ field: "name", column: O.some(4), by: "person", at: 6 }],
      moves: [
        { field: "name", at: 6, was: O.some(1), column: O.some(4), knownFrom: O.none() },
        { field: "uom", at: 6, was: O.some(4), column: O.none(), knownFrom: O.none() }
      ],
      madeOn: { "row-55": 5 },
      set: flags({ "row-55": { accepted: ["uom"] } }),
      changed: []
    })
    expect(made.notApplied).toEqual([{ rowId: "row-55", field: "uom", kind: "accept" }])
  })
})

describe("each kind of decision judged on its row's revision", () => {
  const choices: ReadonlyArray<MappingChoice> = [{ field: "sku", column: O.some(7), by: "person", at: 5 }]
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
    const moved: ReadonlyArray<ColumnMove> = [
      { field: "unitCost", at: 5, was: O.some(5), column: O.some(8), knownFrom: O.none() }
    ]
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
          .decide({ params, payload: { over: {}, madeOn: { "row-3": saving.revision }, set: replace, clear: [] } })
          .pipe(as(marcus))
        // Made while it read "List cost" (3, the stored cost): the comparison changed, it is taken back.
        const between = yield* imports
          .decide({ params, payload: { over: {}, madeOn: { "row-3": once.revision }, set: replace, clear: [] } })
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
            { field: "unitCost", column: O.some(column("Net cost")), by: "person", at: 2 },
            { field: "uom", column: O.some(column("Pack unit")), by: "person", at: 3 }
          ]
          const moves = [
            {
              field: "unitCost" as const,
              at: 2,
              was: O.some(column("unit_cost")),
              column: O.some(column("Net cost")),
              knownFrom: O.none()
            },
            {
              field: "uom" as const,
              at: 3,
              was: O.some(column("uom")),
              column: O.some(column("Pack unit")),
              knownFrom: O.none()
            }
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

    it.effect("is named by the field whose own move changes the comparison, though another field moved too", () =>
      Effect.gen(function* () {
        yield* seeded
        // Row 2's unit reads the same under both unit columns; its cost reads the stored 3 only under "unit_cost".
        const table = tableOf("named.csv", [
          { ...item, sku: "AAA-0002", name: "Steel Bolt XL", unit_cost: "3", "Net cost": "9.00", "Pack unit": "EA" }
        ])
        const view = yield* stage(table).pipe(as(marcus))
        const choices: ReadonlyArray<MappingChoice> = [
          { field: "uom", column: O.some(column("Pack unit")), by: "person", at: 2 },
          { field: "unitCost", column: O.some(column("Net cost")), by: "person", at: 3 }
        ]
        const moves = [
          {
            field: "uom" as const,
            at: 2,
            was: O.some(column("uom")),
            column: O.some(column("Pack unit")),
            knownFrom: O.none()
          },
          {
            field: "unitCost" as const,
            at: 3,
            was: O.some(column("unit_cost")),
            column: O.some(column("Net cost")),
            knownFrom: O.none()
          }
        ]
        const questions = comparisonQuestions({
          choices,
          moves,
          madeOn: { "row-2": 1 },
          set: flags({ "row-2": { stored: "replace" } })
        })
        // One question a row, of every field that moved, in the item's order.
        expect(A.map(questions, ({ rowId, fields }) => [rowId, A.map(fields, ({ field }) => field)])).toEqual([
          ["row-2", ["uom", "unitCost"]]
        ])
        const changed = comparisonsChanged({
          table,
          choices,
          moves,
          storedItems: view.storedItems,
          createdIds: [],
          suggestions: view.suggestions,
          itemsOf: itemsOfRow,
          questions
        })
        expect(changed).toEqual([{ rowId: "row-2", field: "unitCost" }])
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

/** One decision of each kind that rests on a column, as the same-column tests and the picks away and back make them. */
const everyKind: Readonly<Record<string, RowDecisionFlags.Encoded>> = {
  "row-2": { stored: "replace", accepted: ["unitCost"] },
  "row-3": { stored: "keep" },
  "row-4": { kept: true },
  "row-5": { out: true },
  "row-6": { reverted: ["uom"] }
}

describe("a field matched by hand to the column it already reads", () => {
  layer(App)("Only when it changes", (it) => {
    // The SKU, the cost and the unit are each read by their heading: Dana picks the very same columns by hand.
    const picks: ReadonlyArray<{ readonly field: MappingChoice["field"]; readonly column: number }> = [
      { field: "sku", column: column("sku") },
      { field: "unitCost", column: column("unit_cost") },
      { field: "uom", column: column("uom") }
    ]
    const picked = Effect.fn("picked")(function* (id: ImportView["id"]) {
      const imports = yield* importsEndpoints
      yield* Effect.forEach(
        picks,
        (pick) =>
          imports.match({ params: { id }, payload: { field: pick.field, column: O.some(pick.column) } }).pipe(as(dana)),
        { concurrency: 1 }
      )
    })
    const set = flags(everyKind)
    const rows = R.keys(everyKind)

    it.effect(
      "takes nothing back at the match: every kind stands, it is said to be a person's choice, and the audit line claims no take-back",
      () =>
        Effect.gen(function* () {
          const { imports, matching } = yield* seeded
          const params = { id: matching.id }
          yield* imports
            .decide({ params, payload: { over: {}, madeOn: R.map(set, () => matching.revision), set, clear: [] } })
            .pipe(as(marcus))
          yield* picked(matching.id)
          const after = yield* imports.get({ params }).pipe(as(marcus))
          expect(decided(after.decisions, rows)).toEqual(A.map(rows, (row) => R.get(set, row)))
          expect(after.takenBack).toEqual([])
          expect(
            A.map(
              A.filter(after.mapping, (match) => A.some(picks, (pick) => pick.field === match.field)),
              (match) => [match.field, match.how]
            )
          ).toEqual([
            ["sku", "person"],
            ["uom", "person"],
            ["unitCost", "person"]
          ])
          const ref = yield* CatalogMemoryRef
          const state = yield* Ref.get(ref)
          expect(
            A.map(
              A.filter(state.activity, (line) => line.action === "Matched a column"),
              (line) => line.detail
            )
          ).toEqual([
            `SKU reads column A "sku" in reviewed.csv`,
            `Unit cost reads column F "unit_cost" in reviewed.csv`,
            `Unit of measure reads column E "uom" in reviewed.csv`
          ])
        })
    )

    it.effect("takes nothing back at a save or a confirm of decisions made before it, whatever their kind", () =>
      Effect.gen(function* () {
        const { imports, saving } = yield* seeded
        const params = { id: saving.id }
        const madeOn = R.map(set, () => saving.revision)
        yield* picked(saving.id)
        const saved = yield* imports.decide({ params, payload: { over: {}, madeOn, set, clear: [] } }).pipe(as(marcus))
        expect(saved.notApplied).toEqual([])
        const after = yield* imports.get({ params }).pipe(as(marcus))
        expect(decided(after.decisions, rows)).toEqual(A.map(rows, (row) => R.get(set, row)))
        const confirmed = yield* imports
          .commit({ params, payload: { revision: after.revision, madeOn, set, clear: [] } })
          .pipe(as(marcus))
        expect(confirmed.status).toBe("imported")
      })
    )

    it.effect("read by an earlier pick: the same pick again writes nothing, and a decision on it stands", () =>
      Effect.gen(function* () {
        const { imports, saving } = yield* seeded
        const params = { id: saving.id }
        const match = imports
          .match({ params, payload: { field: "unitCost", column: O.some(column("List cost")) } })
          .pipe(as(dana))
        const once = yield* match
        const again = yield* match
        expect([again.revision, again.choices]).toEqual([once.revision, once.choices])
        const saved = yield* imports
          .decide({ params, payload: { over: {}, madeOn: R.map(set, () => once.revision), set, clear: [] } })
          .pipe(as(marcus))
        expect(saved.notApplied).toEqual([])
      })
    )

    it.effect("a field that reads no column, said on purpose to read none, changes nothing either", () =>
      Effect.gen(function* () {
        const { imports, saving } = yield* seeded
        const params = { id: saving.id }
        yield* imports.match({ params, payload: { field: "tags", column: O.none() } }).pipe(as(dana))
        const saved = yield* imports
          .decide({
            params,
            payload: {
              over: {},
              madeOn: { "row-2": saving.revision },
              set: flags({ "row-2": { accepted: ["tags"], reverted: ["tags"] } }),
              clear: []
            }
          })
          .pipe(as(marcus))
        expect(saved.notApplied).toEqual([])
      })
    )
  })
})

describe("a field matched to another column and back to the one it read", () => {
  layer(App)("the two picks each change the column", (it) => {
    it.effect("the SKU: a Replace, a Keep-stored and a keep-one-of-two made before both are taken back", () =>
      Effect.gen(function* () {
        const done = yield* scenario({
          rematch: [
            { field: "sku", column: column("Alt code") },
            { field: "sku", column: column("sku") }
          ],
          set: { "row-2": { stored: "replace" }, "row-3": { stored: "keep" }, "row-4": { kept: true } }
        })
        const named = [
          { rowId: "row-2", field: "sku", kind: "stored" },
          { rowId: "row-3", field: "sku", kind: "stored" },
          { rowId: "row-4", field: "sku", kind: "twin" }
        ]
        expect([done.notApplied, done.refused, done.status]).toEqual([named, named, "open"])
        expect(decided(done.matched, ["row-2", "row-3", "row-4"])).toEqual(
          A.replicate(O.some(decisionFromFlags({})), 3)
        )
      })
    )

    it.effect("the unit: an accept and an undone fix made before both are taken back", () =>
      Effect.gen(function* () {
        const done = yield* scenario({
          rematch: [
            { field: "uom", column: column("Pack unit") },
            { field: "uom", column: column("uom") }
          ],
          set: { "row-2": { accepted: ["uom"] }, "row-6": { reverted: ["uom"] } }
        })
        const named = [
          { rowId: "row-2", field: "uom", kind: "accept" },
          { rowId: "row-6", field: "uom", kind: "undo" }
        ]
        expect([done.notApplied, done.refused, done.status]).toEqual([named, named, "open"])
        expect(decided(done.matched, ["row-2", "row-6"])).toEqual(A.replicate(O.some(decisionFromFlags({})), 2))
      })
    )
  })
})

describe("a Replace or Keep-stored on an import matched before moves were kept", () => {
  // Row 2's cost reads 99.00 in every cost column, so no re-match changes how it compares: only not knowing which
  // column it read takes its Replace back. Row 3's reads 9.00 in "unit_cost" and "Net cost", 3 in "List cost".
  const set = flags({ "row-2": { stored: "replace" }, "row-3": { stored: "keep" } })
  const named = [
    { rowId: "row-2", field: "unitCost", kind: "stored" },
    { rowId: "row-3", field: "unitCost", kind: "stored" }
  ]
  /** The import as a match of its cost to "List cost" left it before moves were kept: a choice, and no move. */
  const matchedLongAgo = Effect.fn("matchedLongAgo")(function* (id: ImportView["id"]) {
    const ref = yield* CatalogMemoryRef
    yield* Ref.update(ref, (state) => ({
      ...state,
      drafts: A.map(state.drafts, (entry) =>
        entry.draft.id === id
          ? {
              ...entry,
              draft: {
                ...entry.draft,
                revision: entry.draft.revision + 1,
                movesJson: "[]",
                choicesJson: `[{"field":"unitCost","column":${column("List cost")},"by":"person","at":${entry.draft.revision + 1}}]`
              }
            }
          : entry
      )
    }))
  })

  layer(App)("Take it back, say so", (it) => {
    it.effect("is named by a save and refuses a confirm, and the same pick again changes nothing of that", () =>
      Effect.gen(function* () {
        const { imports, saving } = yield* seeded
        const params = { id: saving.id }
        const madeOn = R.map(set, () => saving.revision)
        yield* matchedLongAgo(saving.id)
        // The column it reads since, picked again: an old choice with no moves is no change of column.
        const again = yield* imports
          .match({ params, payload: { field: "unitCost", column: O.some(column("List cost")) } })
          .pipe(as(dana))
        expect([again.revision, again.takenBack]).toEqual([saving.revision + 1, []])
        const saved = yield* imports.decide({ params, payload: { over: {}, madeOn, set, clear: [] } }).pipe(as(marcus))
        expect(saved.notApplied).toEqual(named)
        const refused = yield* Effect.flip(
          imports.commit({ params, payload: { revision: saved.revision, madeOn, set, clear: [] } }).pipe(as(marcus))
        )
        expect(S.is(AcceptsTakenBack)(refused) ? refused.accepts : refused).toEqual(named)
        // Decided on the revision that match made, the column is known: both stand.
        const since = yield* imports
          .decide({ params, payload: { over: {}, madeOn: R.map(set, () => saving.revision + 1), set, clear: [] } })
          .pipe(as(marcus))
        expect(since.notApplied).toEqual([])
      })
    )

    it.effect("is dropped by a further match and named in the view; one made before is still not known after it", () =>
      Effect.gen(function* () {
        const { imports, matching } = yield* seeded
        const params = { id: matching.id }
        const madeOn = R.map(set, () => matching.revision)
        yield* imports.decide({ params, payload: { over: {}, madeOn, set, clear: [] } }).pipe(as(marcus))
        yield* matchedLongAgo(matching.id)
        const long = yield* imports.get({ params }).pipe(as(marcus))
        const further = yield* imports
          .match({ params, payload: { field: "unitCost", column: O.some(column("Net cost")) } })
          .pipe(as(dana))
        expect(decided(further.decisions, ["row-2", "row-3"])).toEqual(A.replicate(O.some(decisionFromFlags({})), 2))
        expect(A.map(further.takenBack, (entry) => [entry.field, entry.kind, entry.rows])).toEqual([
          ["unitCost", "stored", ["row-2", "row-3"]]
        ])
        // Made before the match that kept no move: named, though the further match's own move is kept.
        const before = yield* imports.decide({ params, payload: { over: {}, madeOn, set, clear: [] } }).pipe(as(marcus))
        expect(before.notApplied).toEqual(named)
        // Made since that match, on "List cost": the column is known, and row 2 compares the same under "Net cost".
        const replace = flags({ "row-2": { stored: "replace" } })
        const since = yield* imports
          .decide({ params, payload: { over: {}, madeOn: { "row-2": long.revision }, set: replace, clear: [] } })
          .pipe(as(marcus))
        expect(since.notApplied).toEqual([])
        // Its moves are kept from here on: a match that changes nothing of row 2 leaves its Replace.
        const next = yield* imports
          .match({ params, payload: { field: "unitCost", column: O.some(column("unit_cost")) } })
          .pipe(as(dana))
        expect(R.get(next.decisions, "row-2")).toEqual(O.some(decisionFromFlags({ stored: "replace" })))
      })
    )

    it.effect(
      "made after the old match and stored, it is taken back by the next match of that field though the row compares the same, and the entry names it",
      () =>
        Effect.gen(function* () {
          const { imports, matching } = yield* seeded
          const params = { id: matching.id }
          yield* matchedLongAgo(matching.id)
          const long = yield* imports.get({ params }).pipe(as(marcus))
          // Decided on "List cost", which the import reads since: row 2 reads 99.00 in every cost column.
          const replace = flags({ "row-2": { stored: "replace" } })
          const saved = yield* imports
            .decide({ params, payload: { over: {}, madeOn: { "row-2": long.revision }, set: replace, clear: [] } })
            .pipe(as(marcus))
          expect(saved.notApplied).toEqual([])
          const further = yield* imports
            .match({ params, payload: { field: "unitCost", column: O.some(column("Net cost")) } })
            .pipe(as(dana))
          expect(R.get(further.decisions, "row-2")).toEqual(O.some(decisionFromFlags({})))
          expect(further.takenBack).toEqual([
            {
              revision: further.revision,
              by: "Dana Whitfield",
              field: "unitCost",
              matched: O.some("unitCost"),
              reads: O.some(true),
              kind: "stored",
              count: 1,
              rows: ["row-2"],
              saved: O.some({ "row-2": saved.revision })
            }
          ])
        })
    )

    it.effect(
      "made after the old match and stored, it stands through a match of another field, and a confirm imports it as made",
      () =>
        Effect.gen(function* () {
          const { imports, matching } = yield* seeded
          const params = { id: matching.id }
          yield* matchedLongAgo(matching.id)
          const long = yield* imports.get({ params }).pipe(as(marcus))
          const replace = flags({ "row-2": { stored: "replace" } })
          yield* imports
            .decide({ params, payload: { over: {}, madeOn: { "row-2": long.revision }, set: replace, clear: [] } })
            .pipe(as(marcus))
          // Description moves to "Pack unit", empty on row 2 as its own column is: the cost was not matched again.
          const other = yield* imports
            .match({ params, payload: { field: "description", column: O.some(column("Pack unit")) } })
            .pipe(as(dana))
          expect([R.get(other.decisions, "row-2"), other.takenBack]).toEqual([
            O.some(decisionFromFlags({ stored: "replace" })),
            []
          ])
          // The confirm carries nothing of its own: the stored Replace is imported as made, not judged again.
          const confirmed = yield* imports
            .commit({ params, payload: { revision: other.revision, madeOn: {}, set: {}, clear: [] } })
            .pipe(as(marcus))
          const result = O.getOrThrow(confirmed.result)
          expect(result.updated).toEqual(1)
        })
    )
  })
})

describe("a match worked out again because something changed between two tries", () => {
  /**
   * The endpoints, with `between` run once inside the match's first try: after its review read the stored items, before
   * the store writes (the review reads the import's suggestions last). `asked` counts the tries' reads.
   */
  const interrupted = Effect.fn("interrupted")(function* (between: Effect.Effect<unknown>) {
    const inner = yield* SuggestionStore
    const asked = MutableRef.make(0)
    const stepped = SuggestionStore.of({
      ...inner,
      list: Effect.fn("stepped.list")(function* (...args: Parameters<SuggestionStore["Service"]["list"]>) {
        const suggestions = yield* inner.list(...args)
        if (MutableRef.updateAndGet(asked, (n) => n + 1) === 1) yield* between
        return suggestions
      })
    })
    const imports = yield* importsEndpoints.pipe(Effect.provideService(SuggestionStore, stepped))
    return { imports, asked }
  })
  const replace = flags({ "row-2": { stored: "replace" } })

  layer(App)("a save on another row and an item stocked", (it) => {
    it.effect("keep the first try's answer: the item stocked takes nothing back", () =>
      Effect.gen(function* () {
        const plain = yield* importsEndpoints
        const first = yield* stage(stocked).pipe(as(marcus))
        // Nothing is stocked yet under row 2's SKU; stocked at 3, "unit_cost" would compare otherwise than "List cost".
        const view = yield* stage(
          tableOf("held.csv", [
            { ...item, sku: "AAA-0002", name: "Steel Bolt", unit_cost: "9.00", "List cost": "3" },
            { ...item, sku: "DDD-0001", name: "Hemp Rope", unit_cost: "4" }
          ])
        ).pipe(as(marcus))
        const params = { id: view.id }
        yield* plain
          .decide({ params, payload: { over: {}, madeOn: { "row-2": view.revision }, set: replace, clear: [] } })
          .pipe(as(marcus))
        const { imports, asked } = yield* interrupted(
          Effect.all(
            [
              plain
                .commit({
                  params: { id: first.id },
                  payload: { revision: first.revision, madeOn: {}, set: {}, clear: [] }
                })
                .pipe(as(marcus)),
              plain
                .decide({
                  params,
                  payload: { over: {}, madeOn: {}, set: flags({ "row-3": { out: true } }), clear: [] }
                })
                .pipe(as(marcus))
            ],
            { concurrency: 1 }
          ).pipe(Effect.orDie)
        )
        const matched = yield* imports
          .match({ params, payload: { field: "unitCost", column: O.some(column("List cost")) } })
          .pipe(as(dana))
        // Two tries, and the view of the answer.
        expect(MutableRef.get(asked)).toBe(3)
        expect([matched.takenBack, decided(matched.decisions, ["row-2", "row-3"])]).toEqual([
          [],
          [O.some(decisionFromFlags({ stored: "replace" })), O.some(decisionFromFlags({ out: true }))]
        ])
      })
    )
  })

  layer(App)("an item stocked, and the same Replace taken back and made again", (it) => {
    it.effect("the Replace made again takes the second try's answer: made on the column before, it is taken back", () =>
      Effect.gen(function* () {
        const plain = yield* importsEndpoints
        const first = yield* stage(stocked).pipe(as(marcus))
        // Nothing is stocked yet under either row's SKU; stocked, "unit_cost" compares otherwise than "List cost".
        const view = yield* stage(
          tableOf("again.csv", [
            { ...item, sku: "AAA-0002", name: "Steel Bolt", unit_cost: "9.00", "List cost": "3" },
            { ...item, sku: "AAA-0001", name: "Oak Crate", unit_cost: "9.00", "List cost": "12.50" }
          ])
        ).pipe(as(marcus))
        const params = { id: view.id }
        const both = flags({ "row-2": { stored: "replace" }, "row-3": { stored: "replace" } })
        yield* plain
          .decide({ params, payload: { over: {}, madeOn: R.map(both, () => view.revision), set: both, clear: [] } })
          .pipe(as(marcus))
        // Marcus sees the stocked items and presses row 2's Replace again, by way of Keep: the same decision, made again.
        const pressed = (stored: "keep" | "replace") =>
          Effect.flatMap(plain.get({ params }).pipe(as(marcus)), (now) =>
            plain
              .decide({
                params,
                payload: { over: {}, madeOn: { "row-2": now.revision }, set: flags({ "row-2": { stored } }), clear: [] }
              })
              .pipe(as(marcus))
          )
        const { imports, asked } = yield* interrupted(
          plain
            .commit({ params: { id: first.id }, payload: { revision: first.revision, madeOn: {}, set: {}, clear: [] } })
            .pipe(as(marcus), Effect.andThen(pressed("keep")), Effect.andThen(pressed("replace")), Effect.orDie)
        )
        const matched = yield* imports
          .match({ params, payload: { field: "unitCost", column: O.some(column("List cost")) } })
          .pipe(as(dana))
        expect(MutableRef.get(asked)).toBe(3)
        // Row 3's Replace is the one the first try found standing: the item stocked since takes nothing of it back.
        expect(decided(matched.decisions, ["row-2", "row-3"])).toEqual([
          O.some(decisionFromFlags({})),
          O.some(decisionFromFlags({ stored: "replace" }))
        ])
        expect(A.map(matched.takenBack, (entry) => [entry.field, entry.kind, entry.rows])).toEqual([
          ["unitCost", "stored", ["row-2"]]
        ])
      })
    )
  })

  layer(App)("another person's match", (it) => {
    it.effect("starts the answers afresh: a take-back its column causes is not held down by the first try's", () =>
      Effect.gen(function* () {
        const plain = yield* importsEndpoints
        const first = yield* stage(stocked).pipe(as(marcus))
        yield* plain
          .commit({ params: { id: first.id }, payload: { revision: first.revision, madeOn: {}, set: {}, clear: [] } })
          .pipe(as(marcus))
        // Row 2 compares the same under "unit_cost" and "Net cost"; "List cost" says otherwise.
        const view = yield* stage(
          tableOf("afresh.csv", [
            { ...item, sku: "AAA-0002", name: "Steel Bolt XL", unit_cost: "3", "Net cost": "3", "List cost": "9.00" }
          ])
        ).pipe(as(marcus))
        const params = { id: view.id }
        const decideReplace = Effect.flatMap(plain.get({ params }).pipe(as(marcus)), (now) =>
          plain
            .decide({ params, payload: { over: {}, madeOn: { "row-2": now.revision }, set: replace, clear: [] } })
            .pipe(as(marcus))
        )
        yield* decideReplace
        // Marcus matches the cost to "List cost" and decides the Replace again on what row 2 reads there.
        const { imports, asked } = yield* interrupted(
          plain
            .match({ params, payload: { field: "unitCost", column: O.some(column("List cost")) } })
            .pipe(as(marcus), Effect.andThen(decideReplace), Effect.orDie)
        )
        const matched = yield* imports
          .match({ params, payload: { field: "unitCost", column: O.some(column("Net cost")) } })
          .pipe(as(dana))
        expect(MutableRef.get(asked)).toBe(3)
        expect(R.get(matched.decisions, "row-2")).toEqual(O.some(decisionFromFlags({})))
        expect(A.map(matched.takenBack, (entry) => [entry.by, entry.field, entry.kind, entry.rows])).toEqual([
          ["Marcus Oyelaran", "unitCost", "stored", ["row-2"]],
          ["Dana Whitfield", "unitCost", "stored", ["row-2"]]
        ])
      })
    )
  })
})

describe("a save worked out again because something it read changed, and a column matched before it is read again", () => {
  const replace = flags({ "row-2": { stored: "replace" } })
  layer(App)("is judged afresh on the columns it then reads", (it) => {
    it.effect("a take-back the match causes is not held down by what the first try found", () =>
      Effect.gen(function* () {
        const plain = yield* importsEndpoints
        const inner = yield* ImportStore
        const first = yield* stage(stocked).pipe(as(marcus))
        yield* plain
          .commit({ params: { id: first.id }, payload: { revision: first.revision, madeOn: {}, set: {}, clear: [] } })
          .pipe(as(marcus))
        // Row 2 compares the same under "unit_cost" and "List cost"; "Net cost" says otherwise.
        const view = yield* stage(
          tableOf("between.csv", [
            { ...item, sku: "AAA-0002", name: "Steel Bolt XL", unit_cost: "3", "List cost": "3", "Net cost": "9.00" }
          ])
        ).pipe(as(marcus))
        const params = { id: view.id }
        const match = (heading: (typeof headings)[number]) =>
          plain.match({ params, payload: { field: "unitCost", column: O.some(column(heading)) } }).pipe(as(dana))
        yield* match("List cost")
        // The store finds an item the first try read edited since; before the save is read again, Dana matches the cost.
        const tries = MutableRef.make(0)
        const stepped = ImportStore.of({
          ...inner,
          decide: Effect.fn("stepped.decide")(function* (...args: Parameters<ImportStore["Service"]["decide"]>) {
            if (MutableRef.updateAndGet(tries, (n) => n + 1) > 1) return yield* inner.decide(...args)
            yield* Effect.orDie(match("Net cost"))
            return decisionsItemsChanged
          })
        })
        const imports = yield* importsEndpoints.pipe(Effect.provideService(ImportStore, stepped))
        const saved = yield* imports
          .decide({ params, payload: { over: {}, madeOn: { "row-2": view.revision }, set: replace, clear: [] } })
          .pipe(as(marcus))
        expect([MutableRef.get(tries), saved.notApplied]).toEqual([
          2,
          [{ rowId: "row-2", field: "unitCost", kind: "stored" }]
        ])
        const after = yield* plain.get({ params }).pipe(as(marcus))
        expect(R.get(after.decisions, "row-2")).toEqual(O.some(decisionFromFlags({})))
      })
    )
  })
})
