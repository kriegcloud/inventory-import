// A take-back of an import confirmed twice (155 items, then one more after an answer): its result and its audit
// line count every item it removed across both confirms, read from what was stored. And a row with two problems
// names both in its reason. And a take-back of an import that replaced a stored item puts it back as it was, unless
// someone changed it after the replace: then it is kept and named.
import { expect, layer } from "@effect/vitest"
import { Array as Arr, Effect, Option, String as Str } from "effect"
import { HttpApiTest } from "effect/http-api"
import clean from "../../public/samples/items_clean.csv?raw"
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
      // Listed among the past imports at once, its items counted from what is stored.
      const listed = yield* client.imports.past().pipe(marcus)
      expect(Arr.map(listed.imports, (past) => [past.id, past.status, past.items, past.notImported])).toEqual([
        [staged.id, "imported", 155, 45]
      ])
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
      // Still listed, so its result stays one click away, with nothing of it left in the system.
      const after = yield* client.imports.past().pipe(marcus)
      expect(Arr.map(after.imports, (past) => [past.status, past.items])).toEqual([["takenBack", 0]])
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

// The clean sample, then a copy whose row 2 (SKU SHH-9574) has another name and cost, replaced as the person chose.
const replaceRow2 = Effect.fn("test.replaceRow2")(function* () {
  const client = yield* HttpApiTest.groups(Api, ["imports", "items", "activity"])
  const marcus = as("mem_marcus")
  const first = yield* upload({ client, table: yield* stage(new File([clean], "items_clean.csv")) }).pipe(marcus)
  yield* client.imports.commit({ params: { id: first.id }, payload: { set: {}, clear: [] } }).pipe(marcus)
  const copy = Str.replace(
    "SHH-9574,Oak Foam Insert,Oak foam insert for general use.,packaging,EA,12.33,",
    "SHH-9574,Oak Foam Insert XL,Oak foam insert for general use.,packaging,EA,14.10,"
  )(clean)
  expect(copy).not.toBe(clean)
  const second = yield* upload({ client, table: yield* stage(new File([copy], "items_changed.csv")) }).pipe(marcus)
  const replaced = yield* client.imports
    .commit({ params: { id: second.id }, payload: { set: { "row-2": { stored: "replace" } }, clear: [] } })
    .pipe(marcus)
  expect([replaced.result?.updated, replaced.result?.created]).toEqual([1, 0])
  const stored = yield* client.items.list().pipe(marcus)
  const insert = Option.getOrThrow(Arr.findFirst(stored, (item) => item.sku === "SHH-9574"))
  expect([insert.name, insert.unitCost, insert.revision]).toEqual(["Oak Foam Insert XL", "14.1", 2])
  return { client, marcus, first, second, replaced, insert }
})

layer(TypedApp)("a take-back of an import that replaced a stored item", (it) => {
  it.effect("puts the item back with its original name and cost, and says it restored 1", () =>
    Effect.gen(function* () {
      const { client, marcus, first, second, replaced } = yield* replaceRow2()
      expect([replaced.takeBack.removable, replaced.takeBack.restorable, replaced.takeBack.changedCount]).toEqual([
        0, 1, 0
      ])
      const back = yield* client.imports
        .takeBack({ params: { id: second.id }, payload: { confirms: replaced.takeBack.confirms } })
        .pipe(marcus)
      const event = Option.getOrThrow(Arr.findFirst(back.history, (event) => event._tag === "TakenBack"))
      expect(event._tag === "TakenBack" ? [event.removed, event.restored, event.kept] : []).toEqual([0, 1, 0])
      expect([back.status, back.result?.updated, back.result?.takenBack]).toEqual(["takenBack", 0, 1])
      const after = yield* client.items.list().pipe(marcus)
      const insert = Option.getOrThrow(Arr.findFirst(after, (item) => item.sku === "SHH-9574"))
      expect([insert.name, insert.unitCost, insert.revision, after.length]).toEqual(["Oak Foam Insert", "12.33", 1, 25])
      const trail = yield* client.activity.recent().pipe(marcus)
      const line = Option.getOrThrow(Arr.findFirst(trail, (entry) => entry.action === "Took back an import"))
      expect(line.detail).toBe("items_changed.csv: removed 0 items, restored 1 item it had replaced")
      // Back as the first import created it, so that import can take it back again with the others.
      const original = yield* client.imports.get({ params: { id: first.id } }).pipe(marcus)
      expect(original.takeBack.removable).toBe(25)
      // A second press finds nothing in force and writes nothing.
      yield* client.imports
        .takeBack({ params: { id: second.id }, payload: { confirms: replaced.takeBack.confirms } })
        .pipe(marcus)
      const recent = yield* client.activity.recent().pipe(marcus)
      expect(Arr.filter(recent, (e) => e.action === "Took back an import")).toHaveLength(1)
    })
  )
})

layer(TypedApp)("a take-back of an import whose replaced item was edited since", (it) => {
  it.effect("keeps the edited item as it is and names it, and restores nothing", () =>
    Effect.gen(function* () {
      const { client, marcus, second, insert } = yield* replaceRow2()
      yield* client.items
        .edit({
          params: { id: insert.id },
          payload: {
            revision: insert.revision,
            name: "Oak Foam Insert, edited",
            description: insert.description,
            category: insert.category,
            uom: insert.uom,
            unitCost: insert.unitCost,
            quantityOnHand: insert.quantityOnHand,
            reorderPoint: insert.reorderPoint,
            isActive: insert.isActive,
            lotTracked: insert.lotTracked,
            firstReceivedOn: insert.firstReceivedOn,
            discontinuedOn: insert.discontinuedOn
          }
        })
        .pipe(marcus)
      const before = yield* client.imports.get({ params: { id: second.id } }).pipe(marcus)
      expect([before.takeBack.restorable, before.takeBack.changedCount]).toEqual([0, 1])
      expect(Arr.map(before.takeBack.changed, (item) => item.sku)).toEqual(["SHH-9574"])
      const back = yield* client.imports
        .takeBack({ params: { id: second.id }, payload: { confirms: before.takeBack.confirms } })
        .pipe(marcus)
      const event = Option.getOrThrow(Arr.findFirst(back.history, (event) => event._tag === "TakenBack"))
      expect(event._tag === "TakenBack" ? [event.removed, event.restored, event.kept] : []).toEqual([0, 0, 1])
      expect([back.result?.updated, back.result?.takenBack]).toEqual([1, 0])
      expect([back.takeBack.keptCount, Arr.map(back.takeBack.kept, (item) => item.sku)]).toEqual([1, ["SHH-9574"]])
      const stored = yield* client.items.list().pipe(marcus)
      const after = Option.getOrThrow(Arr.findFirst(stored, (item) => item.sku === "SHH-9574"))
      expect([after.name, after.unitCost, after.revision]).toEqual(["Oak Foam Insert, edited", "14.1", 3])
      const trail = yield* client.activity.recent().pipe(marcus)
      const line = Option.getOrThrow(Arr.findFirst(trail, (entry) => entry.action === "Took back an import"))
      expect(line.detail).toBe("items_changed.csv: removed 0 items, kept 1 that had changed since")
    })
  )
})
