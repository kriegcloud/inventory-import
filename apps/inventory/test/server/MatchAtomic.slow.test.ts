// A match and another person's write that fall into each other, on the real handlers and SQL, a fresh D1. Benjamin's
// answer "Server refuses, screen says so" holds only if nothing can land between a match's read and its write, or
// between a save's check of the choices and its write. The match reads the draft, its decisions and the stored items
// inside the store, then writes one batch: so the other write is run inside the D1 store itself, just before (or just
// after) its batch, through a D1 whose batches the test steps into. The save's window is the handler's: a stand-in
// around the store runs the other write once, just before the store's save.
import { D1 } from "@beep/d1/D1"
import { beforeEach, expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as MutableRef from "effect/MutableRef"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import * as HttpApiTest from "effect/http-api/HttpApiTest"
import { decisionFromFlags, type RowDecisionFlags } from "@inventory/catalog-contract/Decision"
import { AcceptsTakenBack, DraftBusy } from "@inventory/catalog-contract/ImportRejection"
import type { StagedTable } from "@inventory/catalog-contract/Staged"
import { ImportStoreD1 } from "@inventory/catalog-host/ImportStoreD1"
import { draftTries, ImportStore } from "@inventory/catalog-model/ImportStore"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
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

// Every test starts with nothing waiting: a test that failed before its batches ran leaves its entries, its count or
// its stand-in behind, and the next test's batches would run them.
beforeEach(() => {
  MutableRef.set(coming, [])
  MutableRef.set(sent, 0)
  MutableRef.set(inside, false)
  MutableRef.set(between, O.none())
})

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

const flags = (set: Readonly<Record<string, RowDecisionFlags>>) => R.map(set, decisionFromFlags)

/** Marcus saves `set` straight through the store, on the draft as it is now: the other person's write. */
const marcusSaves = (store: ImportStore["Service"], id: string, set: Readonly<Record<string, RowDecisionFlags>>) =>
  Effect.flatMap(store.find(prairie, id), (draft) =>
    store.decide(marcusAsMember, O.getOrThrow(draft), { set: flags(set), clear: [] })
  )

/** The messy sample staged by Marcus, and the file's unit cost column. */
const staged = Effect.gen(function* () {
  const client = yield* HttpApiTest.groups(Api, ["imports", "items"])
  const view = yield* upload({ client, table: yield* stage(new File([messy], "items_messy.csv")) }).pipe(
    as("mem_marcus")
  )
  const table = yield* client.imports.table({ params: { id: view.id } }).pipe(as("mem_dana"))
  const cost = O.getOrThrow(A.findFirst(table.columns, (column) => Str.includes("cost")(Str.toLowerCase(column.label))))
  const store = yield* ImportStore
  return { client, view, params: { id: view.id }, cost, store }
})

const headings = ["sku", "name", "category", "uom", "unit_cost", "quantity_on_hand", "Alt code", "List cost"] as const
type Line = Partial<Record<(typeof headings)[number], string>>
const letters = ["A", "B", "C", "D", "E", "F", "G", "H"]
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

/** A Replace on row 2, and what judging it after the cost's re-match takes back once the item is stocked. */
const replace = flags({ "row-2": { stored: "replace" } })
const taken = [{ rowId: "row-2", field: "unitCost", kind: "stored" }]

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
        const { client, view, params, cost, store } = yield* staged
        // Marcus leaves row 3 out once Dana's match has read the import and is about to send its batch.
        yield* around([{ before: Effect.orDie(marcusSaves(store, view.id, { "row-3": { out: true } })) }, {}])
        const matched = yield* client.imports
          .match({ params, payload: { field: "unitCost", column: O.some(cost.index) } })
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
        const { client, view, params, cost } = yield* staged
        // Dana's match lands once Marcus's save has been checked against the choices and is about to be written.
        yield* putBetween("decide", (inner) =>
          Effect.flatMap(inner.find(prairie, view.id), (draft) =>
            inner.matchColumn(danaAsMember, O.getOrThrow(draft), { field: "unitCost", column: cost.index }, "unit cost")
          )
        )
        const saved = yield* client.imports
          .decide({
            params,
            payload: {
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
        const { client, view, params, cost, store } = yield* staged
        // Dana had accepted row 55's cost on the staged picture.
        yield* client.imports
          .decide({
            params,
            payload: {
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
          .match({ params, payload: { field: "unitCost", column: O.some(cost.index) } })
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
          .decide({ params, payload: { madeOn: R.map(set, () => view.revision), set, clear: [] } })
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
            payload: { madeOn: { "row-3": view.revision }, set: flags({ "row-3": { stored: "replace" } }), clear: [] }
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

  it.effect("a match overtaken on every try: refused with DraftBusy after `draftTries` batches, nothing written", () =>
    Effect.gen(function* () {
      const { client, view, params, cost, store } = yield* staged
      // Before each of the match's batches, Marcus changes row 3 again.
      yield* around(
        A.makeBy(draftTries, (index) => ({
          before: Effect.orDie(marcusSaves(store, view.id, { "row-3": { edits: { name: `Copper Plate ${index}` } } }))
        }))
      )
      const refused = yield* Effect.flip(
        client.imports
          .match({ params, payload: { field: "unitCost", column: O.some(cost.index) } })
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
    "a stored item created between a save's judgement and its write: the batch writes nothing, the save is judged again against it",
    () =>
      Effect.gen(function* () {
        const { client, view, params, stock } = yield* judgedAgainst("EEE-0001")
        // Once Marcus's save has been judged (nothing stored under EEE-0001: the Replace stands) and is about to be
        // written, the stocking import is confirmed.
        yield* around([{ before: stock }, {}])
        const saved = yield* client.imports
          .decide({ params, payload: { madeOn: { "row-2": view.revision }, set: replace, clear: [] } })
          .pipe(as("mem_marcus"))
        // Two batches: the first found an item it was not judged against, the second is the save judged again.
        expect([MutableRef.get(sent), saved.notApplied]).toEqual([2, taken])
        const after = yield* client.imports.get({ params }).pipe(as("mem_marcus"))
        expect(R.get(after.decisions, "row-2")).toEqual(O.some(decisionFromFlags({})))
      })
  )

  it.effect(
    "a stored item created between a confirm's judgement and its batch: nothing is imported, the confirm is judged again and refused",
    () =>
      Effect.gen(function* () {
        const { client, view, params, matched, stock } = yield* judgedAgainst("EEE-0002")
        yield* around([{ before: stock }])
        const refused = yield* Effect.flip(
          client.imports
            .commit({
              params,
              payload: { revision: matched.revision, madeOn: { "row-2": view.revision }, set: replace, clear: [] }
            })
            .pipe(as("mem_marcus"))
        )
        expect([MutableRef.get(sent), S.is(AcceptsTakenBack)(refused) ? refused.accepts : []]).toEqual([1, taken])
        const after = yield* client.imports.get({ params }).pipe(as("mem_marcus"))
        expect([after.status, after.revision]).toEqual(["open", matched.revision])
      })
  )

  // The two below run in this order. The first leaves everything waiting, as a test that failed before its batches ran
  // would; the second finds nothing of it.
  it.effect("a test that stops before its batches leaves entries, a count and a stand-in waiting", () =>
    Effect.sync(() => {
      MutableRef.set(coming, [{ before: Effect.die("a batch of the test before") }])
      MutableRef.set(sent, 3)
      MutableRef.set(inside, true)
      MutableRef.set(between, O.some({ before: "decide", run: () => Effect.die("a save of the test before") }))
    })
  )

  it.effect("the next test starts with nothing waiting", () =>
    Effect.sync(() => {
      expect([
        MutableRef.get(coming).length,
        MutableRef.get(sent),
        MutableRef.get(inside),
        MutableRef.get(between)
      ]).toEqual([0, 0, false, O.none()])
    })
  )
})
