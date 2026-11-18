// A take-back of an import confirmed twice (155 items, then one more after an answer): its result and its audit
// line count every item it removed across both confirms, read from what was stored. And a row with two problems
// names both in its reason.
import { expect, layer } from "@effect/vitest"
import { Array as Arr, Effect, Option, String as Str } from "effect"
import { HttpApiTest } from "effect/http-api"
import messy from "../../public/samples/items_messy.csv?raw"
import { Api } from "../../src/api/v1/Api.ts"
import { review } from "../../src/domain/ItemImport.ts"
import { as, TypedApp } from "./support/app.ts"
import { stage } from "./support/files.ts"
import { upload } from "./support/upload.ts"

layer(TypedApp)("a take-back after two confirms", (it) => {
  it.effect("says every item it removed, in its event and in the audit trail, and Items is empty", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiTest.groups(Api, ["imports", "items", "activity"])
      const marcus = as("mem_marcus")
      const table = yield* stage(new File([messy], "items_messy.csv"))
      const staged = yield* upload({ client, table }).pipe(marcus)
      const params = { id: staged.id }
      const first = yield* client.imports.commit({ params, payload: { set: {}, clear: [] } }).pipe(marcus)
      expect(first.result?.created).toBe(155)
      // Opened again, one answer given (the decimal comma on row 55), confirmed again: one more item.
      yield* client.imports.reopen({ params }).pipe(marcus)
      const second = yield* client.imports
        .commit({ params, payload: { set: { "row-55": { accepted: ["unitCost"] } }, clear: [] } })
        .pipe(marcus)
      expect([second.takeBack.confirms.length, second.takeBack.removable]).toEqual([2, 156])
      expect((yield* client.items.list().pipe(marcus)).length).toBe(156)

      const back = yield* client.imports
        .takeBack({ params, payload: { confirms: second.takeBack.confirms } })
        .pipe(marcus)
      const takeBacks = Arr.filter(back.history, (event) => event._tag === "TakenBack")
      expect(Arr.map(takeBacks, (event) => (event._tag === "TakenBack" ? [event.removed, event.kept] : []))).toEqual([
        [156, 0]
      ])
      expect((yield* client.items.list().pipe(marcus)).length).toBe(0)
      const trail = yield* client.activity.recent().pipe(marcus)
      const line = Option.getOrThrow(Arr.findFirst(trail, (entry) => entry.action === "Took back an import"))
      expect(Str.includes("removed 156 items")(line.detail)).toBe(true)
    })
  )

  it.effect(
    "a row with two problems names both: row 56 has two preferred vendors and shares its SKU with row 151",
    () =>
      Effect.gen(function* () {
        const table = yield* stage(new File([messy], "items_messy.csv"))
        const rows = review({ table, choices: [], decisions: {}, storedItems: [] }).rows
        const reason = Arr.join(Option.getOrThrow(Arr.findFirst(rows, (row) => row.rowNumber === 56)).reasons, " ")
        expect([
          Str.includes("vendors are marked preferred")(reason),
          Str.includes("is also on row 151")(reason)
        ]).toEqual([true, true])
      })
  )
})
