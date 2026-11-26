// A match and another person's write that fall into each other, on the real handlers and SQL, a fresh D1. Benjamin's
// answer "Server refuses, screen says so" holds only if nothing can land between a match's read and its write, or
// between a save's check of the choices and its write. The match reads the draft, its decisions and the stored items
// inside the store, then writes one batch: so the other write is run inside the D1 store itself, just before (or just
// after) its batch, through a D1 whose batches the test steps into. The save's window is the handler's: a stand-in
// around the store runs the other write once, just before the store's save. What a judgement of a Replace across a
// re-match read beside the draft (the stored items, the import's created rows, its suggestions) is checked the same
// way: a change to any of them in the window makes the request be worked out again, and never adds a take-back; a column
// matched in between, or the row's own Replace made again, is judged as it then stands. A save's rows that waited are
// compared with what is stored, and written as one with that: what lands in between is compared again.
import { D1 } from "@beep/d1/D1"
import { afterEach, beforeEach, expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as MutableRef from "effect/MutableRef"
import * as O from "effect/Option"
import { noComparison, noItemsRead } from "@inventory/catalog-model/Rematch"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import * as HttpApiTest from "effect/http-api/HttpApiTest"
import { decisionFromFlags, type RowDecisionFlags } from "@inventory/catalog-contract/Decision"
import { ImportId, RowId, SuggestionId } from "@inventory/catalog-contract/Ids"
import { storedSuggestion, suggestedByRule } from "@inventory/catalog-contract/Suggestion"
import { AlreadyImported, DraftBusy } from "@inventory/catalog-contract/ImportRejection"
import type { StagedTable } from "@inventory/catalog-contract/Staged"
import { ImportStoreD1 } from "@inventory/catalog-host/ImportStoreD1"
import { decisionsSaved, draftTries, ImportStore } from "@inventory/catalog-model/ImportStore"
import { StoreSuggestions, SuggestionStore } from "@inventory/catalog-model/SuggestionStore"
import { Activity } from "@inventory/kernel/Activity"
import { ActivityId, MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import messy from "../../public/samples/items_messy.csv?raw"
import { Api } from "../../src/api/v1/Api.ts"
import { as, testAppAround } from "./support/app.ts"
import { stage } from "./support/files.ts"
import { upload } from "./support/upload.ts"

/** What runs around one of the store's next batches: just before it is sent, and just after it answered. */
type Around = { readonly before?: Effect.Effect<unknown>; readonly after?: Effect.Effect<unknown> }

/** One entry per coming batch of the D1 store, in order; an empty entry lets that batch go as it is. */
const coming = MutableRef.make<ReadonlyArray<Around>>([])
/** How many batches the store sent while entries were waiting: a match that tried twice sent two. */
const sent = MutableRef.make(0)
/** True while an entry's own write runs: its batches are not the store's next ones. */
const inside = MutableRef.make(false)

const around = (entries: ReadonlyArray<Around>) =>
  Effect.sync(() => {
    MutableRef.set(coming, entries)
    MutableRef.set(sent, 0)
  })

const runInside = (effect: Effect.Effect<unknown> | undefined): Effect.Effect<void> =>
  effect === undefined
    ? Effect.void
    : Effect.suspend(() => {
        MutableRef.set(inside, true)
        return Effect.asVoid(effect).pipe(Effect.ensuring(Effect.sync(() => MutableRef.set(inside, false))))
      })

/** D1 as it is, but each of the store's next batches runs its entry's writes around it. */
const SteppedD1 = Layer.effect(
  D1,
  Effect.gen(function* () {
    const d1 = yield* D1
    const batch: D1["Service"]["batch"] = (queries) =>
      Effect.suspend(() => {
        const [next, ...rest] = MutableRef.get(coming)
        if (MutableRef.get(inside) || next === undefined) return d1.batch(queries)
        MutableRef.set(coming, rest)
        MutableRef.update(sent, (n) => n + 1)
        return Effect.andThen(
          runInside(next.before),
          Effect.tap(d1.batch(queries), () => runInside(next.after))
        )
      })
    return D1.of({ run: d1.run, batch })
  })
)

type Step = "decide"
type Between = { readonly before: Step; readonly run: (store: ImportStore["Service"]) => Effect.Effect<unknown> }

/** What runs once, just before the store's next save. */
const between = MutableRef.make(O.none<Between>())
const putBetween = (before: Step, run: Between["run"]) =>
  Effect.sync(() => MutableRef.set(between, O.some({ before, run })))

// Every test starts with nothing waiting, and leaves nothing waiting: a test that failed before its batches ran leaves
// its entries, its count or its stand-in behind, and the next test's batches would run them, whichever test it is.
const nothingWaiting = () => {
  MutableRef.set(coming, [])
  MutableRef.set(sent, 0)
  MutableRef.set(inside, false)
  MutableRef.set(between, O.none())
}
beforeEach(nothingWaiting)
afterEach(nothingWaiting)

/** What is waiting for the next batches and saves: all empty when a test starts. */
const waitingNow = () => [
  MutableRef.get(coming).length,
  MutableRef.get(sent),
  MutableRef.get(inside),
  MutableRef.get(between).pipe(O.isSome)
]

/** Everything waiting, as a test that failed before its batches ran would leave it. */
const leaveEverythingWaiting = () => {
  MutableRef.set(coming, [{ before: Effect.die("a batch of the test before") }])
  MutableRef.set(sent, 3)
  MutableRef.set(inside, true)
  MutableRef.set(between, O.some({ before: "decide", run: () => Effect.die("a save of the test before") }))
}

// The real D1 store, built afresh (the app's own is shared, on the plain D1) on the stepped D1, with a stand-in around
// its save.
const Around = Layer.effect(
  ImportStore,
  Effect.gen(function* () {
    const inner = yield* ImportStore
    const first = (step: Step) =>
      Effect.suspend(() =>
        O.match(
          O.filter(MutableRef.get(between), (waiting) => waiting.before === step),
          {
            onNone: () => Effect.void,
            onSome: (waiting) => {
              MutableRef.set(between, O.none())
              return Effect.asVoid(waiting.run(inner))
            }
          }
        )
      )
    return ImportStore.of({
      ...inner,
      decide: Effect.fn("Around.decide")(function* (...args: Parameters<ImportStore["Service"]["decide"]>) {
        yield* first("decide")
        return yield* inner.decide(...args)
      })
    })
  })
).pipe(Layer.provide(Layer.fresh(ImportStoreD1).pipe(Layer.provide(SteppedD1))))

const App = testAppAround(Around)

const prairie = OrganizationId.make("org_prairie")
const person = (id: string, name: string, role: "admin" | "editor") =>
  Member.make({
    id: MemberId.make(id),
    name,
    role,
    organizationId: prairie,
    organizationName: "Example Works (test)"
  })
const marcusAsMember = person("mem_marcus", "Marcus Oyelaran", "editor")
const danaAsMember = person("mem_dana", "Dana Whitfield", "admin")

const flags = (set: Readonly<Record<string, RowDecisionFlags.Encoded>>) => R.map(set, decisionFromFlags)

/** Marcus saves `set` straight through the store, on the draft as it is now: the other person's write. */
const marcusSaves = (
  store: ImportStore["Service"],
  id: string,
  set: Readonly<Record<string, RowDecisionFlags.Encoded>>
) =>
  Effect.flatMap(store.find(prairie, id), (draft) =>
    store.decide(marcusAsMember, O.getOrThrow(draft), { set: flags(set), clear: [] }, noItemsRead, O.none())
  )

/** The messy sample staged by Marcus, and the column Dana's matches give the unit cost: the reorder point's. */
const staged = Effect.gen(function* () {
  const client = yield* HttpApiTest.groups(Api, ["imports", "items"])
  const view = yield* upload({ client, table: yield* stage(new File([messy], "items_messy.csv")) }).pipe(
    as("mem_marcus")
  )
  const table = yield* client.imports.table({ params: { id: view.id } }).pipe(as("mem_dana"))
  const other = O.getOrThrow(
    A.findFirst(table.columns, (column) => Str.includes("reorder")(Str.toLowerCase(column.label)))
  )
  const store = yield* ImportStore
  return { client, view, params: { id: view.id }, other, store }
})

const headings = [
  "sku",
  "name",
  "category",
  "uom",
  "unit_cost",
  "quantity_on_hand",
  "Alt code",
  "List cost",
  "Net cost"
] as const
type Line = Partial<Record<(typeof headings)[number], string>>
const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I"]
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
    cells: A.map(headings, (heading) => ({ text: line[heading] ?? "", shown: O.none() }))
  }))
})
const item = { category: "packaging", uom: "EA", quantity_on_hand: "10" }

/** A Replace on row 2. */
const replace = flags({ "row-2": { stored: "replace" } })

/** A suggestion for row 2 of the import, stored through the suggestion store with its audit line. */
const suggestionStored = Effect.fn("suggestionStored")(function* (
  suggestions: SuggestionStore["Service"],
  importId: ImportId,
  ids: { readonly suggestion: string; readonly line: string }
) {
  const at = yield* DateTime.now
  yield* suggestions.store(
    StoreSuggestions.make({
      draft: importId,
      suggestions: [
        storedSuggestion({
          id: SuggestionId.make(ids.suggestion),
          made: {
            kind: "name",
            rowId: RowId.make("row-2"),
            rowNumber: 2,
            from: "Brass Hinge",
            to: "Brass Hinge M6",
            by: suggestedByRule,
            confidence: "low",
            basis: "A suggestion stored while the request was worked out"
          }
        })
      ],
      audit: Activity.make({
        id: ActivityId.make(ids.line),
        organizationId: prairie,
        actorId: MemberId.make("mem_marcus"),
        actorName: "Marcus Oyelaran",
        action: "Asked for suggestions",
        detail: "",
        agent: O.none(),
        createdAt: at
      })
    })
  )
})

/**
 * A file whose row 2 (under `sku`) costs 9.00 under "unit_cost" and 3 under "List cost", staged with its cost matched to
 * "List cost"; and `stock`, the confirm of a staged import that stocks the SKU at 3. With nothing stored a Replace made
 * before the match compares the same under both columns and stands; with the item stored it compares otherwise.
 */
const judgedAgainst = Effect.fn("judgedAgainst")(function* (sku: string) {
  const client = yield* HttpApiTest.groups(Api, ["imports", "items"])
  const stocking = yield* upload({
    client,
    table: tableOf("stocking.csv", [{ ...item, sku, name: "Brass Hinge", unit_cost: "3" }])
  }).pipe(as("mem_marcus"))
  const view = yield* upload({
    client,
    table: tableOf("judged.csv", [{ ...item, sku, name: "Brass Hinge", unit_cost: "9.00", "List cost": "3" }])
  }).pipe(as("mem_marcus"))
  const params = { id: view.id }
  const matched = yield* client.imports
    .match({ params, payload: { field: "unitCost", column: O.some(column("List cost")) } })
    .pipe(as("mem_dana"))
  const stock = Effect.orDie(
    client.imports
      .commit({ params: { id: stocking.id }, payload: { revision: stocking.revision, madeOn: {}, set: {}, clear: [] } })
      .pipe(as("mem_marcus"))
  )
  return { client, view, params, matched, stock }
})

layer(App)("a match and another person's write that fall into each other", (it) => {
  it.effect(
    "a save between the match's read and its batch: the batch writes nothing, the match is worked out again and stamped with the revision it writes",
    () =>
      Effect.gen(function* () {
        const { client, view, params, other, store } = yield* staged
        // Marcus leaves row 3 out once Dana's match has read the import and is about to send its batch.
        yield* around([{ before: Effect.orDie(marcusSaves(store, view.id, { "row-3": { out: true } })) }, {}])
        const matched = yield* client.imports
          .match({ params, payload: { field: "unitCost", column: O.some(other.index) } })
          .pipe(as("mem_dana"))
        // Two batches: the first found the draft moved on, the second is the match worked out again.
        expect(MutableRef.get(sent)).toBe(2)
        // Two revisions on: Marcus's save, then the match; the choice names the match's own.
        expect(matched.revision).toBe(view.revision + 2)
        expect(
          O.map(
            A.findFirst(matched.choices, (choice) => choice.field === "unitCost"),
            (choice) => choice.at
          )
        ).toEqual(O.some(view.revision + 2))
        // Marcus's screen took his own save's picture and never saw the match: he accepts row 55's cost on it.
        const saved = yield* client.imports
          .decide({
            params,
            payload: {
              over: {},
              madeOn: { "row-55": view.revision + 1 },
              set: { "row-55": decisionFromFlags({ accepted: ["unitCost"] }) },
              clear: []
            }
          })
          .pipe(as("mem_marcus"))
        expect(saved.notApplied).toEqual([{ rowId: "row-55", field: "unitCost", kind: "accept" }])
        const after = yield* client.imports.get({ params }).pipe(as("mem_marcus"))
        expect([R.get(after.decisions, "row-55"), R.get(after.decisions, "row-3")]).toEqual([
          O.some(decisionFromFlags({})),
          O.some(decisionFromFlags({ out: true }))
        ])
      })
  )

  it.effect(
    "a match between a save's check and its write: the save is checked again, and its accept is named and not applied",
    () =>
      Effect.gen(function* () {
        const { client, view, params, other } = yield* staged
        // Dana's match lands once Marcus's save has been checked against the choices and is about to be written.
        yield* putBetween("decide", (inner) =>
          Effect.flatMap(inner.find(prairie, view.id), (draft) =>
            inner.matchColumn(
              danaAsMember,
              O.getOrThrow(draft),
              { field: "unitCost", column: O.some(other.index) },
              "unit cost",
              noComparison
            )
          )
        )
        const saved = yield* client.imports
          .decide({
            params,
            payload: {
              over: {},
              madeOn: { "row-55": view.revision },
              set: { "row-55": decisionFromFlags({ accepted: ["unitCost"] }) },
              clear: []
            }
          })
          .pipe(as("mem_marcus"))
        expect(saved.notApplied).toEqual([{ rowId: "row-55", field: "unitCost", kind: "accept" }])
        const after = yield* client.imports.get({ params }).pipe(as("mem_marcus"))
        expect(R.get(after.decisions, "row-55")).toEqual(O.some(decisionFromFlags({})))
        expect(after.revision).toBe(saved.revision)
      })
  )

  it.effect(
    "a save between the match's read and its batch, on a row the match takes back: the save stands, and the take-back lands with the match's own batch",
    () =>
      Effect.gen(function* () {
        const { client, view, params, other, store } = yield* staged
        // Dana had accepted row 55's cost on the staged picture.
        yield* client.imports
          .decide({
            params,
            payload: {
              over: {},
              madeOn: { "row-55": view.revision },
              set: flags({ "row-55": { accepted: ["unitCost"] } }),
              clear: []
            }
          })
          .pipe(as("mem_dana"))
        // What row 55 holds right after each of the match's batches.
        const seen = MutableRef.make<ReadonlyArray<unknown>>([])
        const look = Effect.orDie(
          Effect.map(client.imports.get({ params }).pipe(as("mem_marcus")), (now) =>
            MutableRef.update(seen, (all) => [...all, R.get(now.decisions, "row-55")])
          )
        )
        // Marcus leaves row 55 out once Dana's match has read the import (his screen still holds her accept).
        yield* around([
          {
            before: Effect.orDie(marcusSaves(store, view.id, { "row-55": { out: true, accepted: ["unitCost"] } })),
            after: look
          },
          { after: look }
        ])
        yield* client.imports
          .match({ params, payload: { field: "unitCost", column: O.some(other.index) } })
          .pipe(as("mem_dana"))
        // The first batch wrote nothing over his save; the second took the accept out of the row as he left it.
        expect(MutableRef.get(seen)).toEqual([
          O.some(decisionFromFlags({ out: true, accepted: ["unitCost"] })),
          O.some(decisionFromFlags({ out: true }))
        ])
        const after = yield* client.imports.get({ params }).pipe(as("mem_marcus"))
        expect(R.get(after.decisions, "row-55")).toEqual(O.some(decisionFromFlags({ out: true })))
      })
  )

  it.effect(
    "a save between the match's read and its batch, on rows of every kind the match takes back: every leave-out stands, every take-back is named",
    () =>
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["imports", "items"])
        const store = yield* ImportStore
        // Rows 3 and 4 share a SKU; row 5's unit is "each". The SKU will read the unit's column, which moves the unit.
        const table = tableOf("kinds.csv", [
          { ...item, sku: "AAA-0001", name: "Oak Crate", unit_cost: "1" },
          { ...item, sku: "BBB-0001", name: "Twin A", unit_cost: "1" },
          { ...item, sku: "BBB-0001", name: "Twin B", unit_cost: "2" },
          { ...item, sku: "CCC-0001", name: "Hemp Rope", uom: "each", unit_cost: "4" }
        ])
        const view = yield* upload({ client, table }).pipe(as("mem_marcus"))
        const params = { id: view.id }
        const set = flags({
          "row-2": { stored: "replace", accepted: ["uom"] },
          "row-3": { kept: true },
          "row-5": { reverted: ["uom"] }
        })
        yield* client.imports
          .decide({ params, payload: { over: {}, madeOn: R.map(set, () => view.revision), set, clear: [] } })
          .pipe(as("mem_dana"))
        yield* around([
          {
            before: Effect.orDie(
              marcusSaves(store, view.id, {
                "row-2": { out: true, stored: "replace", accepted: ["uom"] },
                "row-3": { out: true, kept: true },
                "row-5": { out: true, reverted: ["uom"] }
              })
            )
          },
          {}
        ])
        const matched = yield* client.imports
          .match({ params, payload: { field: "sku", column: O.some(column("uom")) } })
          .pipe(as("mem_dana"))
        expect(MutableRef.get(sent)).toBe(2)
        const out = O.some(decisionFromFlags({ out: true }))
        expect(A.map(["row-2", "row-3", "row-5"], (row) => R.get(matched.decisions, row))).toEqual([out, out, out])
        expect(A.map(matched.takenBack, (entry) => [entry.field, entry.kind, entry.rows])).toEqual([
          ["sku", "stored", ["row-2"]],
          ["sku", "twin", ["row-3"]],
          ["uom", "accept", ["row-2"]],
          ["uom", "undo", ["row-5"]]
        ])
      })
  )

  it.effect(
    "a stored item taken back between the match's read and its batch: the match is judged again against the items as they are",
    () =>
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["imports", "items"])
        // Two items stocked by a first import. In the file, row 3's cost reads 9.00 under "unit_cost" (the stored item
        // says 3) and 3 under "List cost": a Replace on it is taken back when the cost is matched to "List cost".
        const stocked = yield* upload({
          client,
          table: tableOf("stocked.csv", [
            { ...item, sku: "AAA-0001", name: "Oak Crate", unit_cost: "12.50" },
            { ...item, sku: "AAA-0002", name: "Steel Bolt", unit_cost: "3" }
          ])
        }).pipe(as("mem_marcus"))
        const confirmed = yield* client.imports
          .commit({
            params: { id: stocked.id },
            payload: { revision: stocked.revision, madeOn: {}, set: {}, clear: [] }
          })
          .pipe(as("mem_marcus"))
        const view = yield* upload({
          client,
          table: tableOf("reviewed.csv", [
            { ...item, sku: "AAA-0001", name: "Oak Crate", unit_cost: "99.00", "List cost": "99.00" },
            { ...item, sku: "AAA-0002", name: "Steel Bolt", unit_cost: "9.00", "List cost": "3" }
          ])
        }).pipe(as("mem_marcus"))
        const params = { id: view.id }
        yield* client.imports
          .decide({
            params,
            payload: {
              over: {},
              madeOn: { "row-3": view.revision },
              set: flags({ "row-3": { stored: "replace" } }),
              clear: []
            }
          })
          .pipe(as("mem_marcus"))
        // Once Dana's match has asked the review (the stored item was there), the first import is taken back: no item
        // is stored for row 3 any more, so the cost's column cannot change how it compares.
        yield* around([
          {
            before: Effect.orDie(
              client.imports
                .takeBack({ params: { id: stocked.id }, payload: { confirms: confirmed.takeBack.confirms } })
                .pipe(as("mem_marcus"))
            )
          },
          {}
        ])
        const matched = yield* client.imports
          .match({ params, payload: { field: "unitCost", column: O.some(column("List cost")) } })
          .pipe(as("mem_dana"))
        expect(MutableRef.get(sent)).toBe(2)
        expect([R.get(matched.decisions, "row-3"), matched.takenBack]).toEqual([
          O.some(decisionFromFlags({ stored: "replace" })),
          []
        ])
      })
  )

  it.effect(
    "a save on another row and an item stocked between the match's read and its batch: what the first try answered stands",
    () =>
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["imports", "items"])
        const store = yield* ImportStore
        const stocking = yield* upload({
          client,
          table: tableOf("held-stocking.csv", [{ ...item, sku: "GGG-0001", name: "Brass Hinge", unit_cost: "3" }])
        }).pipe(as("mem_marcus"))
        // Nothing is stocked under row 2's SKU; stocked at 3, "unit_cost" would compare otherwise than "List cost".
        const view = yield* upload({
          client,
          table: tableOf("held.csv", [
            { ...item, sku: "GGG-0001", name: "Brass Hinge", unit_cost: "9.00", "List cost": "3" },
            { ...item, sku: "GGG-0002", name: "Oak Crate", unit_cost: "4" }
          ])
        }).pipe(as("mem_marcus"))
        const params = { id: view.id }
        yield* client.imports
          .decide({ params, payload: { over: {}, madeOn: { "row-2": view.revision }, set: replace, clear: [] } })
          .pipe(as("mem_marcus"))
        // Once Dana's match has asked the review, the item is stocked and Marcus leaves row 3 out.
        const stock = client.imports
          .commit({
            params: { id: stocking.id },
            payload: { revision: stocking.revision, madeOn: {}, set: {}, clear: [] }
          })
          .pipe(as("mem_marcus"))
        yield* around([
          { before: Effect.orDie(Effect.andThen(stock, marcusSaves(store, view.id, { "row-3": { out: true } }))) },
          {}
        ])
        const matched = yield* client.imports
          .match({ params, payload: { field: "unitCost", column: O.some(column("List cost")) } })
          .pipe(as("mem_dana"))
        expect(MutableRef.get(sent)).toBe(2)
        expect([matched.takenBack, R.get(matched.decisions, "row-2"), R.get(matched.decisions, "row-3")]).toEqual([
          [],
          R.get(replace, "row-2"),
          O.some(decisionFromFlags({ out: true }))
        ])
      })
  )

  it.effect(
    "another person's match between the match's read and its batch: the answers start afresh, and a take-back its column causes is made",
    () =>
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["imports", "items"])
        const store = yield* ImportStore
        const stocking = yield* upload({
          client,
          table: tableOf("afresh-stocking.csv", [{ ...item, sku: "HHH-0001", name: "Brass Hinge", unit_cost: "3" }])
        }).pipe(as("mem_marcus"))
        yield* client.imports
          .commit({
            params: { id: stocking.id },
            payload: { revision: stocking.revision, madeOn: {}, set: {}, clear: [] }
          })
          .pipe(as("mem_marcus"))
        // Row 2 compares the same under "unit_cost" and "Net cost"; "List cost" says otherwise.
        const view = yield* upload({
          client,
          table: tableOf("afresh.csv", [
            {
              ...item,
              sku: "HHH-0001",
              name: "Brass Hinge XL",
              unit_cost: "3",
              "List cost": "9.00",
              "Net cost": "3"
            }
          ])
        }).pipe(as("mem_marcus"))
        const params = { id: view.id }
        yield* client.imports
          .decide({ params, payload: { over: {}, madeOn: { "row-2": view.revision }, set: replace, clear: [] } })
          .pipe(as("mem_marcus"))
        // Once Dana's match has asked the review, Marcus matches the cost to "List cost" and decides the Replace again.
        const theirs = client.imports
          .match({ params, payload: { field: "unitCost", column: O.some(column("List cost")) } })
          .pipe(as("mem_marcus"))
        yield* around([
          {
            before: Effect.orDie(
              Effect.andThen(theirs, marcusSaves(store, view.id, { "row-2": { stored: "replace" } }))
            )
          },
          {}
        ])
        const matched = yield* client.imports
          .match({ params, payload: { field: "unitCost", column: O.some(column("Net cost")) } })
          .pipe(as("mem_dana"))
        expect(MutableRef.get(sent)).toBe(2)
        expect(R.get(matched.decisions, "row-2")).toEqual(O.some(decisionFromFlags({})))
        expect(A.map(matched.takenBack, (entry) => [entry.by, entry.field, entry.kind, entry.rows])).toEqual([
          ["Marcus Oyelaran", "unitCost", "stored", ["row-2"]],
          ["Dana Whitfield", "unitCost", "stored", ["row-2"]]
        ])
      })
  )

  it.effect("a match overtaken on every try: refused with DraftBusy after `draftTries` batches, nothing written", () =>
    Effect.gen(function* () {
      const { client, view, params, other, store } = yield* staged
      // Before each of the match's batches, Marcus changes row 3 again.
      yield* around(
        A.makeBy(draftTries, (index) => ({
          before: Effect.orDie(marcusSaves(store, view.id, { "row-3": { edits: { name: `Copper Plate ${index}` } } }))
        }))
      )
      const refused = yield* Effect.flip(
        client.imports
          .match({ params, payload: { field: "unitCost", column: O.some(other.index) } })
          .pipe(as("mem_dana"))
      )
      expect([S.is(DraftBusy)(refused), MutableRef.get(sent)]).toEqual([true, draftTries])
      const after = yield* client.imports.get({ params }).pipe(as("mem_marcus"))
      expect([after.revision, A.some(after.choices, (choice) => choice.field === "unitCost")]).toEqual([
        view.revision + draftTries,
        false
      ])
    })
  )

  it.effect(
    "a stored item created between a save's judgement and its write: the save is worked out again, and the item takes nothing back",
    () =>
      Effect.gen(function* () {
        const { client, view, params, stock } = yield* judgedAgainst("EEE-0001")
        // Once Marcus's save has been judged (nothing stored under EEE-0001: the Replace stands) and is about to be
        // written, the stocking import is confirmed.
        yield* around([{ before: stock }, {}])
        const saved = yield* client.imports
          .decide({ params, payload: { over: {}, madeOn: { "row-2": view.revision }, set: replace, clear: [] } })
          .pipe(as("mem_marcus"))
        // Two batches: the first found an item it was not judged against, the second is the save worked out again.
        // Only an item changed, not a column: what the first try found stands, and the Replace with it.
        expect([MutableRef.get(sent), saved.notApplied]).toEqual([2, []])
        const after = yield* client.imports.get({ params }).pipe(as("mem_marcus"))
        expect(R.get(after.decisions, "row-2")).toEqual(R.get(replace, "row-2"))
      })
  )

  it.effect(
    "a stored item created between a confirm's judgement and its batch: the confirm is worked out again, the item takes nothing back, and it is imported",
    () =>
      Effect.gen(function* () {
        const { client, view, params, matched, stock } = yield* judgedAgainst("EEE-0002")
        const seen = MutableRef.make("")
        const look = Effect.orDie(
          Effect.map(client.imports.get({ params }).pipe(as("mem_marcus")), (now) => MutableRef.set(seen, now.status))
        )
        yield* around([{ before: stock, after: look }])
        const confirmed = yield* client.imports
          .commit({
            params,
            payload: { revision: matched.revision, madeOn: { "row-2": view.revision }, set: replace, clear: [] }
          })
          .pipe(as("mem_marcus"))
        // The first batch wrote nothing (the import still open right after it); the confirm worked out again did.
        expect([MutableRef.get(seen), confirmed.status, confirmed.takenBack]).toEqual(["open", "imported", []])
      })
  )

  it.effect(
    "the confirm's judgement reads item X, X is edited, the confirm is worked out again: nothing is taken back, and X is replaced as edited",
    () =>
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["imports", "items"])
        // X is stocked at 3 by a first import. In the file, row 2 names it otherwise and costs 3 under both columns.
        const stocking = yield* upload({
          client,
          table: tableOf("x-stocked.csv", [{ ...item, sku: "XXX-0001", name: "Brass Hinge", unit_cost: "3" }])
        }).pipe(as("mem_marcus"))
        yield* client.imports
          .commit({
            params: { id: stocking.id },
            payload: { revision: stocking.revision, madeOn: {}, set: {}, clear: [] }
          })
          .pipe(as("mem_marcus"))
        const view = yield* upload({
          client,
          table: tableOf("x-judged.csv", [
            { ...item, sku: "XXX-0001", name: "Brass Hinge XL", unit_cost: "3", "List cost": "3.00" }
          ])
        }).pipe(as("mem_marcus"))
        const params = { id: view.id }
        const matched = yield* client.imports
          .match({ params, payload: { field: "unitCost", column: O.some(column("List cost")) } })
          .pipe(as("mem_dana"))
        const listed = yield* client.items.list().pipe(as("mem_marcus"))
        const stored = O.getOrThrow(A.findFirst(listed, (found) => found.sku === "XXX-0001"))
        // Once Marcus's confirm has read X (the cost reads 3 under either column: the Replace stands) and is about
        // to be written, Dana edits X on the Items page.
        const edit = Effect.orDie(
          client.items
            .edit({
              params: { id: stored.id },
              payload: {
                revision: stored.revision,
                name: "Brass Hinge, edited",
                description: stored.description,
                category: stored.category,
                uom: stored.uom,
                unitCost: stored.unitCost,
                quantityOnHand: stored.quantityOnHand,
                reorderPoint: stored.reorderPoint,
                stocking: stored.stocking,
                lotTracked: stored.lotTracked,
                firstReceivedOn: stored.firstReceivedOn
              }
            })
            .pipe(as("mem_dana"))
        )
        const seen = MutableRef.make("")
        const look = Effect.orDie(
          Effect.map(client.imports.get({ params }).pipe(as("mem_marcus")), (now) => MutableRef.set(seen, now.status))
        )
        yield* around([{ before: edit, after: look }])
        const confirmed = yield* client.imports
          .commit({
            params,
            payload: { revision: matched.revision, madeOn: { "row-2": view.revision }, set: replace, clear: [] }
          })
          .pipe(as("mem_marcus"))
        // The first batch found X edited since it read it and wrote nothing; the confirm worked out again wrote.
        expect([MutableRef.get(seen), confirmed.status, O.getOrUndefined(confirmed.result)?.updated]).toEqual([
          "open",
          "imported",
          1
        ])
        const now = yield* client.items.list().pipe(as("mem_marcus"))
        const after = O.getOrThrow(A.findFirst(now, (found) => found.sku === "XXX-0001"))
        expect(after.name).toBe("Brass Hinge XL")
      })
  )

  it.effect(
    "a suggestion stored between a save's judgement and its write: storing it moves no revision, and the save is still worked out again",
    () =>
      Effect.gen(function* () {
        const { client, view, params } = yield* judgedAgainst("EEE-0003")
        const suggestions = yield* SuggestionStore
        const stored = suggestionStored(suggestions, view.id, {
          suggestion: "00000000-0000-4000-8000-000000000301",
          line: "00000000-0000-4000-8000-000000000302"
        })
        yield* around([{ before: stored }, {}])
        const saved = yield* client.imports
          .decide({ params, payload: { over: {}, madeOn: { "row-2": view.revision }, set: replace, clear: [] } })
          .pipe(as("mem_marcus"))
        expect([MutableRef.get(sent), saved.notApplied]).toEqual([2, []])
      })
  )

  it.effect(
    "a suggestion stored between a confirm's judgement and its batch: the confirm is worked out again, and imported",
    () =>
      Effect.gen(function* () {
        const { client, view, params, matched } = yield* judgedAgainst("EEE-0004")
        const suggestions = yield* SuggestionStore
        const seen = MutableRef.make("")
        const look = Effect.orDie(
          Effect.map(client.imports.get({ params }).pipe(as("mem_marcus")), (now) => MutableRef.set(seen, now.status))
        )
        const stored = suggestionStored(suggestions, view.id, {
          suggestion: "00000000-0000-4000-8000-000000000303",
          line: "00000000-0000-4000-8000-000000000304"
        })
        yield* around([{ before: stored, after: look }])
        const confirmed = yield* client.imports
          .commit({
            params,
            payload: { revision: matched.revision, madeOn: { "row-2": view.revision }, set: replace, clear: [] }
          })
          .pipe(as("mem_marcus"))
        // The first batch found a suggestion it had not read and wrote nothing; the confirm worked out again wrote.
        expect([MutableRef.get(seen), confirmed.status]).toEqual(["open", "imported"])
      })
  )

  it.effect(
    "a created row taken back between a save's judgement and its write, its item under a SKU typed on another row: the save is worked out again",
    () =>
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["imports", "items"])
        const view = yield* upload({
          client,
          table: tableOf("created.csv", [
            { ...item, sku: "FFF-0001", name: "Brass Hinge", unit_cost: "9.00", "List cost": "3" },
            { ...item, sku: "FFF-0002", name: "Oak Crate", unit_cost: "4" }
          ])
        }).pipe(as("mem_marcus"))
        const params = { id: view.id }
        // Row 2 left out; row 3 imported under a SKU typed for it, which no question to the review looks up.
        const first = flags({ "row-2": { out: true }, "row-3": { edits: { sku: "TYP-0001" } } })
        const confirmed = yield* client.imports
          .commit({
            params,
            payload: { revision: view.revision, madeOn: R.map(first, () => view.revision), set: first, clear: [] }
          })
          .pipe(as("mem_marcus"))
        const reopened = yield* client.imports.reopen({ params }).pipe(as("mem_marcus"))
        const matched = yield* client.imports
          .match({ params, payload: { field: "unitCost", column: O.some(column("List cost")) } })
          .pipe(as("mem_dana"))
        expect(matched.createdIds).toEqual(["row-3"])
        // Once Marcus's save of a Replace on row 2, made before the match, has been judged and is about to be written,
        // Dana takes the import's confirm back: row 3's item goes, and no item under a key the review read changes.
        yield* around([
          {
            before: Effect.orDie(
              client.imports
                .takeBack({ params, payload: { confirms: confirmed.takeBack.confirms } })
                .pipe(as("mem_dana"))
            )
          },
          {}
        ])
        yield* client.imports
          .decide({ params, payload: { over: {}, madeOn: { "row-2": reopened.revision }, set: replace, clear: [] } })
          .pipe(as("mem_marcus"))
        // Two batches: the first found the import's created rows otherwise than its judgement read them.
        expect(MutableRef.get(sent)).toBe(2)
        const after = yield* client.imports.get({ params }).pipe(as("mem_marcus"))
        expect(after.createdIds).toEqual([])
      })
  )

  it.effect(
    "a suggestion stored between a save's judgement and its batch, and a column matched before its next try: the take-back the column causes is made",
    () =>
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["imports", "items"])
        const suggestions = yield* SuggestionStore
        const stocking = yield* upload({
          client,
          table: tableOf("next-stocking.csv", [{ ...item, sku: "JJJ-0001", name: "Brass Hinge", unit_cost: "3" }])
        }).pipe(as("mem_marcus"))
        yield* client.imports
          .commit({
            params: { id: stocking.id },
            payload: { revision: stocking.revision, madeOn: {}, set: {}, clear: [] }
          })
          .pipe(as("mem_marcus"))
        // Row 2 compares the same under "unit_cost" and "List cost"; "Net cost" says otherwise.
        const view = yield* upload({
          client,
          table: tableOf("next.csv", [
            { ...item, sku: "JJJ-0001", name: "Brass Hinge XL", unit_cost: "3", "List cost": "3", "Net cost": "9.00" }
          ])
        }).pipe(as("mem_marcus"))
        const params = { id: view.id }
        const match = (heading: (typeof headings)[number]) =>
          client.imports
            .match({ params, payload: { field: "unitCost", column: O.some(column(heading)) } })
            .pipe(as("mem_dana"))
        yield* match("List cost")
        yield* around([
          {
            before: suggestionStored(suggestions, view.id, {
              suggestion: "00000000-0000-4000-8000-000000000305",
              line: "00000000-0000-4000-8000-000000000306"
            }),
            after: Effect.orDie(match("Net cost"))
          },
          {}
        ])
        const saved = yield* client.imports
          .decide({ params, payload: { over: {}, madeOn: { "row-2": view.revision }, set: replace, clear: [] } })
          .pipe(as("mem_marcus"))
        expect([MutableRef.get(sent), saved.notApplied]).toEqual([
          2,
          [{ rowId: "row-2", field: "unitCost", kind: "stored" }]
        ])
        const after = yield* client.imports.get({ params }).pipe(as("mem_marcus"))
        expect(R.get(after.decisions, "row-2")).toEqual(O.some(decisionFromFlags({})))
      })
  )

  it.effect(
    "an item stocked between the match's read and its batch, and the same Replace taken back and made again: the one made again is taken back, the one that stood is not",
    () =>
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["imports", "items"])
        const store = yield* ImportStore
        const stocking = yield* upload({
          client,
          table: tableOf("again-stocking.csv", [
            { ...item, sku: "KKK-0001", name: "Brass Hinge", unit_cost: "3" },
            { ...item, sku: "KKK-0002", name: "Oak Crate", unit_cost: "4" }
          ])
        }).pipe(as("mem_marcus"))
        // Nothing is stocked under either SKU; stocked, "unit_cost" would compare otherwise than "List cost".
        const view = yield* upload({
          client,
          table: tableOf("again.csv", [
            { ...item, sku: "KKK-0001", name: "Brass Hinge", unit_cost: "9.00", "List cost": "3" },
            { ...item, sku: "KKK-0002", name: "Oak Crate", unit_cost: "9.00", "List cost": "4" }
          ])
        }).pipe(as("mem_marcus"))
        const params = { id: view.id }
        yield* marcusSaves(store, view.id, { "row-2": { stored: "replace" }, "row-3": { stored: "replace" } })
        const stock = client.imports
          .commit({
            params: { id: stocking.id },
            payload: { revision: stocking.revision, madeOn: {}, set: {}, clear: [] }
          })
          .pipe(as("mem_marcus"))
        // Once Dana's match has asked the review, Marcus sees the item and presses row 2's Replace again, by way of Keep.
        yield* around([
          {
            before: stock.pipe(
              Effect.andThen(marcusSaves(store, view.id, { "row-2": { stored: "keep" } })),
              Effect.andThen(marcusSaves(store, view.id, { "row-2": { stored: "replace" } })),
              Effect.orDie
            )
          },
          {}
        ])
        const matched = yield* client.imports
          .match({ params, payload: { field: "unitCost", column: O.some(column("List cost")) } })
          .pipe(as("mem_dana"))
        expect(MutableRef.get(sent)).toBe(2)
        expect([R.get(matched.decisions, "row-2"), R.get(matched.decisions, "row-3")]).toEqual([
          O.some(decisionFromFlags({})),
          O.some(decisionFromFlags({ stored: "replace" }))
        ])
        expect(A.map(matched.takenBack, (entry) => [entry.kind, entry.rows])).toEqual([["stored", ["row-2"]]])
      })
  )

  /** Dana's save of row 3's leave-out, which waited over no decision, and of row 4's, which did not wait. */
  const waited = (view: { readonly revision: number }) => ({
    madeOn: { "row-3": view.revision, "row-4": view.revision },
    set: flags({ "row-3": { edits: { name: "Copper Plate" } }, "row-4": { out: true } }),
    clear: [],
    over: { "row-3": [O.none()] }
  })

  it.effect(
    "a colleague's decision between a save's comparison of a row that waited and its batch: compared again, named with theirs, the other row written",
    () =>
      Effect.gen(function* () {
        const { client, view, params, store } = yield* staged
        yield* around([{ before: Effect.orDie(marcusSaves(store, view.id, { "row-3": { out: true } })) }, {}])
        const saved = yield* client.imports.decide({ params, payload: waited(view) }).pipe(as("mem_dana"))
        // Two batches: the first found the draft moved on and wrote nothing, not the other row either.
        expect([MutableRef.get(sent), saved.decidedSince, saved.revision]).toEqual([
          2,
          [{ rowId: "row-3", theirs: O.some(decisionFromFlags({ out: true })) }],
          view.revision + 2
        ])
        const after = yield* client.imports.get({ params }).pipe(as("mem_marcus"))
        expect([R.get(after.decisions, "row-3"), R.get(after.decisions, "row-4")]).toEqual([
          O.some(decisionFromFlags({ out: true })),
          O.some(decisionFromFlags({ out: true }))
        ])
      })
  )

  it.effect("a match between a save's comparison of a row that waited and its batch: compared again, and written", () =>
    Effect.gen(function* () {
      const { client, view, params, other } = yield* staged
      const match = client.imports
        .match({ params, payload: { field: "unitCost", column: O.some(other.index) } })
        .pipe(as("mem_marcus"))
      yield* around([{ before: Effect.orDie(match) }, {}])
      const saved = yield* client.imports.decide({ params, payload: waited(view) }).pipe(as("mem_dana"))
      expect([MutableRef.get(sent), saved.decidedSince, saved.changed]).toEqual([2, [], true])
    })
  )

  it.effect(
    "a confirm between a save's comparison of a row that waited and its batch: refused, and nothing of it written",
    () =>
      Effect.gen(function* () {
        const { client, view, params } = yield* staged
        const confirm = client.imports
          .commit({ params, payload: { revision: view.revision, madeOn: {}, set: {}, clear: [] } })
          .pipe(as("mem_marcus"))
        yield* around([{ before: Effect.orDie(confirm) }, {}])
        const refused = yield* Effect.flip(
          client.imports.decide({ params, payload: waited(view) }).pipe(as("mem_dana"))
        )
        expect(S.is(AlreadyImported)(refused)).toBe(true)
        const after = yield* client.imports.get({ params }).pipe(as("mem_marcus"))
        expect([R.get(after.decisions, "row-3"), R.get(after.decisions, "row-4")]).toEqual([O.none(), O.none()])
      })
  )

  it.effect(
    "a save of rows that waited overtaken on every try: refused with DraftBusy after `draftTries` batches, nothing written; a live one is not",
    () =>
      Effect.gen(function* () {
        const { client, view, params, store } = yield* staged
        const overtaking = A.makeBy(draftTries, (index) => ({
          before: Effect.orDie(marcusSaves(store, view.id, { "row-5": { edits: { name: `Plate ${index}` } } }))
        }))
        yield* around(overtaking)
        const refused = yield* Effect.flip(
          client.imports.decide({ params, payload: waited(view) }).pipe(as("mem_dana"))
        )
        expect([S.is(DraftBusy)(refused), MutableRef.get(sent)]).toEqual([true, draftTries])
        const after = yield* client.imports.get({ params }).pipe(as("mem_marcus"))
        expect([R.get(after.decisions, "row-3"), R.get(after.decisions, "row-4")]).toEqual([O.none(), O.none()])
        yield* around([{ before: Effect.orDie(marcusSaves(store, view.id, { "row-5": { out: true } })) }, {}])
        const saved = yield* client.imports
          .decide({ params, payload: { ...waited(view), over: {} } })
          .pipe(as("mem_dana"))
        expect([saved.changed, MutableRef.get(sent)]).toEqual([true, 1])
      })
  )

  it.effect(
    "a colleague's save of exactly what is stored between a save's comparison of a row that waited and its batch: it moves no revision, and the save is compared again",
    () =>
      Effect.gen(function* () {
        const { client, view, params, store } = yield* staged
        const first = yield* marcusSaves(store, view.id, { "row-5": { out: true } })
        const again = marcusSaves(store, view.id, { "row-5": { out: true } })
        yield* around([{ before: Effect.orDie(again) }, {}])
        const saved = yield* client.imports.decide({ params, payload: waited(view) }).pipe(as("mem_dana"))
        // Two batches: the first found another save since its comparison, though the draft's revision had not moved.
        expect([first, MutableRef.get(sent), saved.decidedSince, saved.changed]).toEqual([
          decisionsSaved({ revision: view.revision + 1, changed: true }),
          2,
          [],
          true
        ])
      })
  )

  // Each of the two below starts by finding nothing waiting, then leaves everything waiting, as a test that failed
  // before its batches ran would: whichever runs second, in any order, shows that what the other left was cleared.
  it.effect("a test starts with nothing waiting, and may leave entries, a count and a stand-in behind (one)", () =>
    Effect.sync(() => {
      expect(waitingNow()).toEqual([0, 0, false, false])
      leaveEverythingWaiting()
    })
  )

  it.effect("a test starts with nothing waiting, and may leave entries, a count and a stand-in behind (two)", () =>
    Effect.sync(() => {
      expect(waitingNow()).toEqual([0, 0, false, false])
      leaveEverythingWaiting()
    })
  )
})

layer(App)("a take-back of the import itself between a save's comparison of a row that waited and its batch", (it) => {
  it.effect("compared again, and judged by what the match took back, not by the items the take-back changed", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiTest.groups(Api, ["imports", "items"])
      const confirmed = (id: ImportId, revision: number) =>
        client.imports.commit({ params: { id }, payload: { revision, madeOn: {}, set: {}, clear: [] } })
      const stocking = yield* upload({
        client,
        table: tableOf("sack-stock.csv", [{ ...item, sku: "CCC-0001", name: "Jute Sack", unit_cost: "5" }])
      }).pipe(as("mem_marcus"))
      yield* confirmed(stocking.id, stocking.revision).pipe(as("mem_marcus"))
      // The sack reads 5 under "unit_cost" and 7 under "Net cost"; the burlap sack is created by the confirm below.
      const view = yield* upload({
        client,
        table: tableOf("sacks.csv", [
          { ...item, sku: "CCC-0001", name: "Jute Sack", unit_cost: "5", "Net cost": "7" },
          { ...item, sku: "DDD-0001", name: "Burlap Sack", unit_cost: "2" }
        ])
      }).pipe(as("mem_marcus"))
      const params = { id: view.id }
      yield* confirmed(view.id, view.revision).pipe(as("mem_marcus"))
      const open = yield* client.imports.reopen({ params }).pipe(as("mem_marcus"))
      const mine = decisionFromFlags({ stored: "replace", edits: { name: "Sack" } })
      yield* client.imports
        .decide({
          params,
          payload: { over: {}, madeOn: { "row-2": open.revision }, set: { "row-2": mine }, clear: [] }
        })
        .pipe(as("mem_dana"))
      const match = yield* client.imports
        .match({ params, payload: { field: "unitCost", column: O.some(column("Net cost")) } })
        .pipe(as("mem_marcus"))
      const confirms = match.takeBack.confirms
      const takeBack = client.imports.takeBack({ params, payload: { confirms } }).pipe(as("mem_marcus"))
      yield* around([{ before: Effect.orDie(takeBack) }, {}])
      const saved = yield* client.imports
        .decide({
          params,
          payload: {
            madeOn: { "row-2": open.revision },
            set: flags({ "row-2": { out: true } }),
            clear: [],
            over: { "row-2": [O.none(), O.some(mine)] }
          }
        })
        .pipe(as("mem_dana"))
      const sentBySave = MutableRef.get(sent)
      const after = yield* client.imports.get({ params }).pipe(as("mem_marcus"))
      // Two batches: the first found the draft moved on by the take-back and wrote nothing.
      expect([sentBySave, saved.decidedSince, after.createdRows, after.status]).toEqual([2, [], [], "open"])
      expect(R.get(after.decisions, "row-2")).toEqual(O.some(decisionFromFlags({ out: true })))
    })
  )
})
