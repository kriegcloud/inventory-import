// What the review says must be true and must be enough to act on. Each test is a sentence that was wrong on a screen
// built from this starter: a rule's suggestion called "a guess by the model", a row with no fix that said nothing
// about why, rows nothing here can fix counted as decisions, an enabled import button that could do nothing, a table
// wider than the screen, money shown as "31.4", and the same status word kept in two places.
// @effect-diagnostics nodeBuiltinImport:off
import { readFileSync } from "node:fs"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Record as Rec, String as Str } from "effect"
import { firstDecisions, review, stageTable, type StagedTable } from "../../src/domain/ItemImport.ts"
import { sourceLead, sourceWordsFor } from "@inventory/ui/ProposalSource"
import {
  act,
  count,
  decisionsLeft,
  emptyState,
  fixableBy,
  heldCsv,
  heldLine,
  kindsOf,
  primary,
  reasonOf,
  restored,
  viewRows,
  visible
} from "../../src/web/components/review/logic.ts"
import { planColumns, type SizedColumn } from "../../src/web/components/review/sizing.ts"
import type { ProblemKind, ReviewColumn, ReviewRow } from "../../src/web/components/review/types.ts"
import { defaultReviewWords, reviewWords } from "../../src/web/components/review/words.ts"
import { readSpreadsheet } from "../../src/web/lib/spreadsheet/index.ts"
import type { ItemFields } from "../../src/domain/Item.ts"
import { costText, dimensionsCellText, vendorsCellText } from "../../src/web/pages/import/itemText.ts"
import { vendorsDraft } from "../../src/web/pages/import/cellDrafts.ts"
import { reasonShown, regionColumns, regionKinds, toRegionRows } from "../../src/web/pages/import/reviewAdapter.ts"

const sample = (name: string): File =>
  new File([readFileSync(new URL(`../../public/samples/${name}`, import.meta.url))], name)

const stage = (file: File): Effect.Effect<StagedTable> =>
  Effect.orDie(Effect.map(readSpreadsheet({ file }), (table) => stageTable({ table })))

// As the screen opens a file: the draft a new import starts with (the rules' own fixes held back as proposals).
const sampleRows = (name = "items_messy.csv", storedItems: ReadonlyArray<ItemFields> = []) =>
  Effect.map(stage(sample(name)), (table) => {
    const decisions = firstDecisions({ table, choices: [], mode: "propose" })
    const current = review({ table, choices: [], decisions, storedItems })
    return { current, decisions, rows: toRegionRows(current, decisions) }
  })

describe("who is behind a suggestion", () => {
  it("names the model only when the caller says a model made it", () => {
    expect(sourceWordsFor("model").tip).toContain("model")
    for (const source of ["rule", "person", undefined] as const) {
      const words = sourceWordsFor(source)
      expect(Str.toLowerCase(`${words.tag} ${words.hidden} ${words.tip}`)).not.toContain("model")
    }
    expect(sourceLead({ by: "rule", confidence: "low" })).toBe("Rule, low confidence")
    expect(sourceLead({ confidence: "low" })).toBe("Suggestion, low confidence")
  })

  it.effect("calls the sample's low-confidence date reading a rule's, never a model's", () =>
    Effect.map(sampleRows(), ({ rows }) => {
      const fixes = Arr.flatMap(rows, (row) => [
        ...(row.applied ?? []),
        ...(row.problem?.fix === undefined ? [] : [row.problem.fix])
      ])
      const questions = Arr.filter(fixes, (fix) => fix.confidence === "low")
      expect(questions.length).toBeGreaterThan(0)
      for (const fix of fixes) expect(fix.by).toBe("rule")
      for (const fix of questions) expect(Str.toLowerCase(sourceLead(fix))).not.toContain("model")
    })
  )
})

describe("every row says why", () => {
  it.effect("gives each row of the sample that is not ready a sentence, the row with no fix included", () =>
    Effect.map(sampleRows(), ({ current, decisions, rows }) => {
      const views = viewRows({ rows, state: restored(decisions) })
      const kinds = kindsOf(regionKinds)
      const open = Arr.filter(views, (view) => view.status === "needs")
      expect(open.length).toBe(current.counts.needs)
      // A row with an empty SKU has no fix, only a refusal: it still says why, in the domain's own sentence.
      const noFix = Arr.filter(open, (view) => view.problem?.fix === undefined)
      expect(noFix.length).toBeGreaterThan(0)
      for (const view of open) {
        const domain = Option.getOrUndefined(Arr.findFirst(current.rows, (row) => row.id === view.row.id))
        // The first problem's sentence, and how many more the row has behind it.
        expect(reasonOf({ view, kinds })).toBe(reasonShown(domain?.reason ?? "", domain?.reasons.length ?? 0))
      }
    })
  )
})

// A kind nothing on the screen can settle: the item the row names is not in the system yet.
const kinds: ReadonlyArray<ProblemKind> = [
  { id: "unit", label: "Unit", tone: "decision" },
  { id: "unknown", label: "Not in system", tone: "blocker", fixable: false }
]
const columns: ReadonlyArray<ReviewColumn> = [{ id: "name", label: "Name" }]
const row = (line: number, extra: Partial<ReviewRow> = {}): ReviewRow => ({
  id: `row-${line}`,
  line,
  cells: { name: `Item ${line}` },
  ...extra
})
const unknownItem = (line: number) =>
  row(line, { problem: { kind: "unknown", reason: `Item ${line} is not in the system yet.` } })

describe("rows that cannot be fixed here", () => {
  const rows = [row(2), unknownItem(3), unknownItem(4), row(5, { problem: { kind: "unit", column: "name" } })]
  const fixable = fixableBy(kinds)
  const views = viewRows({ rows, state: emptyState, fixable })

  it("are counted apart from the decisions, with their reason, and never offer an answer", () => {
    const counts = count(views)
    expect([counts.ready, counts.needs, counts.cannot, counts.out]).toEqual([1, 1, 2, 0])
    expect(counts.needs + counts.cannot + counts.ready + counts.out + counts.stored).toBe(counts.total)
    expect(decisionsLeft(views)).toBe(1)
    expect(Arr.map(visible({ views, filter: "cannot" }), (view) => view.row.line)).toEqual([3, 4])
    expect(Arr.map(visible({ views, filter: "needs" }), (view) => view.row.line)).toEqual([5])
    const cannot = Option.getOrUndefined(Arr.findFirst(views, (view) => view.row.line === 3))
    expect(cannot === undefined ? "" : reasonOf({ view: cannot, kinds: kindsOf(kinds) })).toBe(
      "Item 3 is not in the system yet."
    )
    expect(act({ rows, state: emptyState, action: { type: "leaveOut", rowIds: ["row-3"] }, fixable }).label).toBe("")
    expect(heldLine(counts)).toBe("3 won't be imported: Needs a decision 1, Cannot import 2")
  })

  it("do not hold the import back", () => {
    expect(primary({ columns, counts: count(views), noun: ["item", "items"] })).toEqual({
      label: "Import 1 item",
      blocked: false
    })
  })
})

describe("a button that could do nothing is never offered", () => {
  const noun = ["item", "items"] as const

  it("is idle while decisions are open and nothing is ready", () => {
    const counts = count(viewRows({ rows: [row(2, { problem: { kind: "unit", column: "name" } })], state: emptyState }))
    expect(primary({ columns, counts, noun })).toEqual({ label: "No items ready yet", blocked: true, idle: true })
  })

  it("gives way to words when only rows nothing here can fix are left", () => {
    const counts = count(viewRows({ rows: [unknownItem(2)], state: emptyState, fixable: fixableBy(kinds) }))
    expect(primary({ columns, counts, noun })).toEqual({
      label: defaultReviewWords.nothingToImport,
      blocked: true,
      done: true
    })
  })

  it.effect("ends a second load of the same file on 'Nothing new' once every row is already there", () =>
    Effect.gen(function* () {
      // Every item of the clean sample is stored, as after a first import of every row.
      const first = yield* sampleRows("items_clean.csv")
      const items = Arr.flatMap(first.current.rows, (each) => (each.item === null ? [] : [each.item]))
      expect(items.length).toBe(25)
      const { rows } = yield* sampleRows("items_clean.csv", items)
      const counts = count(viewRows({ rows, state: emptyState }))
      expect(counts.stored).toBe(25)
      expect(primary({ columns, counts, noun })).toEqual({
        label: "Nothing new: this file is already in",
        blocked: true,
        done: true
      })
    })
  )
})

describe("status words", () => {
  it("are set once by the caller and said everywhere they show", () => {
    const words = reviewWords({ out: "Skipped", stored: "In stock already", needs: "Waiting on you" })
    const rows = [row(2, { problem: { kind: "unit", column: "name" } }), row(3), row(4, { stored: true })]
    const left = act({ rows, state: emptyState, action: { type: "leaveOut", rowIds: ["row-3"] } }).state
    const views = viewRows({ rows, state: left })
    const csv = heldCsv({ views, columns, problemKinds: kinds, words })
    expect(csv).toContain("3,Skipped,Item 3")
    expect(csv).toContain("4,In stock already,Item 4")
    expect(csv).not.toContain(defaultReviewWords.out)
    expect(heldLine(count(views), words)).toBe("3 won't be imported: Waiting on you 1, Skipped 1, In stock already 1")
  })

  it("keep the current words as defaults, each said once", () => {
    const values = Rec.values(defaultReviewWords)
    expect(Arr.dedupe(values)).toHaveLength(values.length)
    expect(reviewWords(undefined)).toEqual(defaultReviewWords)
  })
})

describe("the table fits at 1440", () => {
  // At 1440 by 900 with the sidebar open the review's table has about 1,130 px, less the work list on Needs you.
  const room = 1134
  const fit = (id: string, need: number, priority = 0): SizedColumn => ({
    id,
    size: "fit",
    need,
    priority,
    keep: false
  })
  const fill = (id: string, need: number, priority = 0): SizedColumn => ({
    id,
    size: "fill",
    need,
    priority,
    keep: false
  })

  it("moves columns into the row's detail, a second description included, before it scrolls sideways", () => {
    const columns = [
      { ...fill("name", 200), keep: true },
      { ...fill("reason", 180), keep: true },
      fill("description", 200, 1),
      fill("supplier", 200, 1),
      fit("part", 150, 2),
      fit("pack", 140, 1),
      fit("price", 110, 2),
      fit("lead", 90),
      fit("date", 110),
      fill("note", 200)
    ]
    const plan = planColumns({ columns, fixed: 360 + 120, room })
    expect(plan.scrolls).toBe(false)
    expect(plan.minWidth).toBeLessThanOrEqual(room)
    expect(Arr.map(plan.shown, (column) => column.id)).toContain("reason")
  })
})

describe("a cost, the dimensions and the vendors in the review", () => {
  it("read as the Items page shows them, and a value that does not read stays as the file has it", () => {
    expect(costText("31.4")).toBe("$31.40")
    expect(costText("1095")).toBe("$1,095.00")
    expect(costText("0.0125")).toBe("$0.0125")
    expect(costText("12.34567")).toBe("12.34567")
    expect(costText("TBD")).toBe("TBD")
    expect(costText("")).toBe("")
    expect(dimensionsCellText('{"length":78.8,"width":56.9,"height":2.6,"unit":"cm"}')).toBe("78.8 × 56.9 × 2.6 cm")
    expect(dimensionsCellText('{"length":78.8,"width":56.9}')).toBe('{"length":78.8,"width":56.9}')
    expect(
      vendorsCellText(
        '[{"vendor_name":"Acme Industrial","unit_cost":3.35},{"vendor_name":"Summit Polymers","is_preferred":true}]'
      )
    ).toBe("2 · Summit Polymers preferred")
    expect(vendorsCellText('[{"vendor_name":"Acme')).toBe('[{"vendor_name":"Acme')
    // A cell cut off after a vendor's name says so, with the name, instead of showing the file's JSON.
    expect(vendorsCellText('[{"vendor_name":"Keystone Components","vendor_sku":"KE-61504')).toBe(
      "Cut off · Keystone Components"
    )
  })

  it("opens the vendors form with what a cut-off cell holds, whole vendors and the one cut short", () => {
    // Rows 80 and 157 of the messy sample.
    expect(vendorsDraft('[{"vendor_name":"Keystone Components","vendor_sku":"KE-61504')).toEqual([
      { name: "Keystone Components", sku: "KE-61504", cost: "", lead: "", preferred: false }
    ])
    expect(
      vendorsDraft(
        '[{"vendor_name":"Acme Industrial","unit_cost":3.5,"is_preferred":true},{"vendor_name":"Copperline Supply","vendor_sku":"CO-33160","unit_cost":14.19,"is_preferred":false'
      )
    ).toEqual([
      { name: "Acme Industrial", sku: "", cost: "3.5", lead: "", preferred: true },
      { name: "Copperline Supply", sku: "CO-33160", cost: "14.19", lead: "", preferred: false }
    ])
  })

  it.effect("is how the sample's cost column shows, with no second currency sign in its header", () =>
    Effect.map(
      Effect.map(stage(sample("items_messy.csv")), (table) => ({
        table,
        current: review({ table, choices: [], decisions: {}, storedItems: [] })
      })),
      ({ table, current }) => {
        const cost = Option.getOrUndefined(
          Arr.findFirst(
            regionColumns(current.mapping, current.unusedColumns, table),
            (column) => column.id === "unitCost"
          )
        )
        expect(cost?.unit).toBeUndefined()
        expect(cost?.display?.("31.4")).toBe("$31.40")
      }
    )
  )
})
