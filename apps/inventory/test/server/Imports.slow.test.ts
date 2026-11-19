// An import of inventory items through the real handlers and SQL, on a fresh D1 database: staged, decided, confirmed,
// counted back from what is stored, loaded a second time, a stored item replaced only when the person says so, and
// taken back. The claims are the screens': the result's numbers add up to the rows of the file and are read from the
// stored rows, a second load creates nothing twice, and the server reviews with the same rules as the screen.
import { expect, layer } from "@effect/vitest"
import { cost, digits } from "../support/cost.ts"
import { Array as Arr, Effect, Option, String as Str } from "effect"
import { HttpApiTest } from "effect/http-api"
import clean from "../../public/samples/items_clean.csv?raw"
import messy from "../../public/samples/items_messy.csv?raw"
import { Api } from "../../src/api/v1/Api.ts"
import { decisionFromFlags } from "@inventory/catalog-contract/Decision"
import { as, TypedApp } from "./support/app.ts"
import { stage } from "./support/files.ts"
import { upload } from "./support/upload.ts"

layer(TypedApp)("an import of items", (it) => {
  it.effect(
    "is confirmed, counted from what is stored, loaded again without creating anything twice, and taken back",
    () =>
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["imports", "items", "activity"])
        const marcus = as("mem_marcus")
        const table = yield* stage(new File([messy], "items_messy.csv"))

        const staged = yield* upload({ client, table }).pipe(marcus)
        expect([staged.status, staged.progress]).toEqual([
          "open",
          {
            needsAtStart: 45,
            needs: 45,
            decision: 24,
            cannot: 21,
            ready: 155,
            fixedRows: 17,
            fixedCells: 20,
            rows: 200
          }
        ])
        expect(staged.unusedColumns).toEqual([{ index: 15, letter: "P", label: "Internal Notes", filled: 20 }])

        // The person accepts the decimal comma on row 55 and undoes the rule's "bx" on row 18.
        yield* client.imports
          .decide({
            params: { id: staged.id },
            payload: {
              set: {
                "row-55": decisionFromFlags({ accepted: ["unitCost"] }),
                "row-18": decisionFromFlags({ reverted: ["uom"] })
              },
              clear: []
            }
          })
          .pipe(marcus)
        const confirmed = yield* client.imports
          .commit({ params: { id: staged.id }, payload: { set: {}, clear: [] } })
          .pipe(marcus)
        const result = Option.getOrThrow(confirmed.result)
        expect([result.created, result.updated, result.already, result.notImported]).toEqual([155, 0, 0, 45])
        expect(result.fixed).toEqual({ rows: 16, cells: 19 })
        const outcomeOf = (n: number) => Arr.findFirst(result.rows, (row) => row.rowNumber === n)
        expect(
          Option.map(outcomeOf(18), (row) => (row.outcome === "notImported" ? [row.decidedBy, row.reason] : row))
        ).toEqual(Option.some([{ kind: "nobody" }, 'Unit of measure "bx" is not one of EA, BX, KG, M, L.']))

        // What landed, as any member reads it: nested values decoded, the cost as the digits said.
        const stored = yield* client.items.list().pipe(as("mem_priya"))
        expect(stored.length).toBe(155)
        const bySku = (sku: string) => Option.getOrThrow(Arr.findFirst(stored, (item) => item.sku === sku))
        const comma = Option.getOrThrow(outcomeOf(55))
        expect([comma.outcome, digits(bySku(comma.sku).unitCost)]).toEqual(["created", "35.82"])
        const crate = bySku("XRR-0266")
        expect(crate).toMatchObject({
          name: "Fiberglass Crate",
          lotTracked: false,
          stocking: { kind: "discontinued", on: "2025-02-26" },
          tags: ["fragile"],
          dimensions: Option.some({ length: 97.4, width: 6.9, height: 4.4, unit: "cm" })
        })
        // A cost is compared by its digits: a decimal caches its shortest form once it has been written.
        const vendor = Option.getOrThrow(Arr.get(crate.vendors, 1))
        expect({ ...vendor, unitCost: digits(vendor.unitCost) }).toEqual({
          vendorName: "Tidewater Fasteners",
          vendorSku: Option.none(),
          unitCost: "3.87",
          leadTimeDays: Option.some(43),
          isPreferred: false
        })
        // "Internal Notes" was never stored: no item carries the text.
        expect(
          Arr.some(stored, (item) => Str.includes("purchasing")(Option.getOrElse(item.description, () => "")))
        ).toBe(false)

        // The Items table's questions run in SQL: a cost filter, a select, a search and the facets.
        const page = yield* client.items
          .page({
            query: {
              page: 1,
              perPage: 10,
              sort: [{ id: "unitCost", desc: true }],
              filters: [
                { id: "unitCost", value: "500", variant: "number", operator: "gt" },
                { id: "category", value: ["finished-goods"], variant: "select", operator: "inArray" }
              ],
              joinOperator: "and",
              search: "oak"
            }
          })
          .pipe(marcus)
        expect(page.total).toBeGreaterThan(0)
        expect(
          Arr.every(page.data, (item) => Number(digits(item.unitCost)) > 500 && item.category === "finished-goods")
        ).toBe(true)
        const facets = yield* client.items.facets().pipe(marcus)
        expect([facets.total, Arr.reduce(facets.uom, 0, (n, row) => n + row.count)]).toEqual([155, 155])

        // The same file again: nothing is created twice. 154 of the 155 items it created are already there; row 55,
        // imported after its "35,82" was accepted as 35.82, does not read as written, so it is not "already there":
        // it waits with its own proposal, and is in the not-imported rows with its reason. Row 18, whose "bx" was
        // held back the first time, is the one new item: this time the rule's fix stands.
        const again = yield* upload({ client, table }).pipe(marcus)
        expect(again.progress).toMatchObject({ ready: 1, needs: 45 })
        const second = yield* client.imports
          .commit({ params: { id: again.id }, payload: { set: {}, clear: [] } })
          .pipe(marcus)
        expect([
          Option.getOrUndefined(second.result)?.created,
          Option.getOrUndefined(second.result)?.already,
          Option.getOrUndefined(second.result)?.notImported
        ]).toEqual([1, 154, 45])
        expect((yield* client.items.list().pipe(marcus)).length).toBe(156)

        // A file whose row says something else than a stored item: it waits, and only "replace" changes the item.
        const changed = yield* stage(
          new File([Str.replace("Oak Foam Insert,", "Oak Foam Insert XL,")(clean)], "items_clean.csv")
        )
        const first = yield* upload({ client, table: yield* stage(new File([clean], "items_clean.csv")) }).pipe(marcus)
        yield* client.imports.commit({ params: { id: first.id }, payload: { set: {}, clear: [] } }).pipe(marcus)
        const third = yield* upload({ client, table: changed }).pipe(marcus)
        expect([third.progress.decision, third.storedItems.length]).toEqual([1, 25])
        const replaced = yield* client.imports
          .commit({
            params: { id: third.id },
            payload: { set: { "row-2": decisionFromFlags({ stored: "replace" }) }, clear: [] }
          })
          .pipe(marcus)
        expect([
          Option.getOrUndefined(replaced.result)?.updated,
          Option.getOrUndefined(replaced.result)?.already,
          Option.getOrUndefined(replaced.result)?.created
        ]).toEqual([1, 24, 0])
        const after = yield* client.items.list().pipe(marcus)
        const insert = Option.getOrThrow(Arr.findFirst(after, (item) => item.sku === "SHH-9574"))
        expect([insert.name, insert.revision, after.length]).toEqual(["Oak Foam Insert XL", 2, 181])

        // An edit by hand, then the take-back of the clean import: 24 removed, the replaced item kept and named.
        const edited = yield* client.items
          .edit({
            params: { id: crate.id },
            payload: {
              revision: crate.revision,
              name: "Fiberglass Crate, large",
              description: crate.description,
              category: crate.category,
              uom: crate.uom,
              unitCost: cost("4.6"),
              quantityOnHand: crate.quantityOnHand,
              reorderPoint: crate.reorderPoint,
              stocking: crate.stocking,
              lotTracked: crate.lotTracked,
              firstReceivedOn: crate.firstReceivedOn
            }
          })
          .pipe(marcus)
        expect([edited.name, digits(edited.unitCost), edited.revision, edited.tags]).toEqual([
          "Fiberglass Crate, large",
          "4.6",
          2,
          ["fragile"]
        ])
        const before = yield* client.imports.get({ params: { id: first.id } }).pipe(marcus)
        expect([before.takeBack.removable, before.takeBack.changedCount]).toEqual([24, 1])
        const taken = yield* client.imports
          .takeBack({ params: { id: first.id }, payload: { confirms: before.takeBack.confirms } })
          .pipe(marcus)
        expect([
          taken.status,
          Option.getOrUndefined(taken.result)?.takenBack,
          Option.getOrUndefined(taken.result)?.created
        ]).toEqual(["takenBack", 24, 1])
        expect((yield* client.items.list().pipe(marcus)).length).toBe(157)
      })
  )
})
