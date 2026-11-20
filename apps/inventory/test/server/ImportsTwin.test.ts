// The messy sample through the catalog's in-memory twins, held to the numbers the D1 adapter gives for the same
// steps (Imports.slow.test.ts and TakeBack.slow.test.ts): one save, a confirm, a second load of the same file and a
// take-back. A twin whose counts drifted from the adapter's fails here, fast. The twin's refusals (a stale accept, a
// confirm overtaken by a save, a revision ahead of the draft) are held in the model package's Endpoints.test.ts.
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Str from "effect/String"
import * as HttpApiTest from "effect/http-api/HttpApiTest"
import messy from "../../public/samples/items_messy.csv?raw"
import { Api } from "../../src/api/v1/Api.ts"
import { decisionFromFlags } from "@inventory/catalog-contract/Decision"
import { ImportEvent } from "@inventory/catalog-contract/Import"
import { ModelId } from "@beep/openrouter/OpenRouterModel"
import { OpenRouterTest } from "@beep/openrouter/OpenRouterTest"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { digits } from "../support/cost.ts"
import { inMemoryHandlers } from "./support/app.ts"
import { stage } from "./support/files.ts"
import { upload } from "./support/upload.ts"

const marcus = Member.make({
  id: MemberId.make("mem_marcus"),
  name: "Marcus Oyelaran",
  role: "editor",
  organizationId: OrganizationId.make("org_prairie"),
  organizationName: "Example Works (test)"
})

layer(inMemoryHandlers({ member: marcus, ai: OpenRouterTest.off("noKey", ModelId.make("test/model")) }))(
  "the messy sample, over the twins",
  (it) => {
    it.effect("stages, confirms, loads again and takes back with the numbers D1 gives", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["imports", "items"])
        const table = yield* stage(new File([messy], "items_messy.csv"))
        const staged = yield* upload({ client, table })
        expect(staged.progress).toEqual({
          needsAtStart: 45,
          needs: 45,
          decision: 24,
          cannot: 21,
          ready: 155,
          fixedRows: 17,
          fixedCells: 20,
          rows: 200
        })
        const params = { id: staged.id }
        const saved = yield* client.imports.decide({
          params,
          payload: {
            madeOn: { "row-55": staged.revision, "row-18": staged.revision },
            set: {
              "row-55": decisionFromFlags({ accepted: ["unitCost"] }),
              "row-18": decisionFromFlags({ reverted: ["uom"] })
            },
            clear: []
          }
        })
        const confirmed = yield* client.imports.commit({
          params,
          payload: { revision: saved.revision, madeOn: {}, set: {}, clear: [] }
        })
        const result = O.getOrThrow(confirmed.result)
        expect([result.created, result.updated, result.already, result.notImported]).toEqual([155, 0, 0, 45])
        expect(result.fixed).toEqual({ rows: 16, cells: 19 })
        const row18 = A.findFirst(result.rows, (row) => row.rowNumber === 18)
        expect(O.map(row18, (row) => (row.outcome === "notImported" ? [row.decidedBy, row.reason] : row))).toEqual(
          O.some([{ kind: "nobody" }, 'Unit of measure "bx" is not one of EA, BX, KG, M, L.'])
        )
        const stored = yield* client.items.list()
        expect(stored.length).toBe(155)
        const crate = O.getOrThrow(A.findFirst(stored, (item) => item.sku === "XRR-0266"))
        expect([crate.name, crate.stocking, digits(crate.vendors[1]?.unitCost)]).toEqual([
          "Fiberglass Crate",
          { kind: "discontinued", on: "2025-02-26" },
          "3.87"
        ])
        const past = yield* client.imports.past()
        expect(A.map(past.imports, (row) => [row.status, row.items, row.notImported])).toEqual([["imported", 155, 45]])
        const facets = yield* client.items.facets()
        expect([facets.total, A.reduce(facets.uom, 0, (n, row) => n + row.count)]).toEqual([155, 155])
        const page = yield* client.items.page({
          query: {
            page: 1,
            perPage: 10,
            sort: [{ id: "unitCost", desc: true }],
            filters: [{ id: "category", value: ["finished-goods"], variant: "select", operator: "inArray" }],
            joinOperator: "and",
            search: "oak"
          }
        })
        expect(page.total).toBeGreaterThan(0)
        expect(
          A.every(
            page.data,
            (item) => item.category === "finished-goods" && Str.includes("oak")(Str.toLowerCase(item.name))
          )
        ).toBe(true)

        // The same file again: 154 already there, row 55 waits with its proposal, row 18 is the one new item.
        const again = yield* upload({ client, table })
        expect(again.progress).toMatchObject({ ready: 1, needs: 45 })
        const second = yield* client.imports.commit({
          params: { id: again.id },
          payload: { revision: again.revision, madeOn: {}, set: {}, clear: [] }
        })
        const secondResult = O.getOrThrow(second.result)
        expect([secondResult.created, secondResult.already, secondResult.notImported]).toEqual([1, 154, 45])

        // Taking the first import back removes its 155 and keeps the second's one.
        const back = yield* client.imports.takeBack({ params, payload: { confirms: confirmed.takeBack.confirms } })
        const taken = A.filter(back.history, ImportEvent.guards.TakenBack)
        expect(A.map(taken, (event) => [event.removed, event.kept])).toEqual([[155, 0]])
        const left = yield* client.items.list()
        expect([back.status, left.length]).toEqual(["takenBack", 1])
      })
    )
  }
)
