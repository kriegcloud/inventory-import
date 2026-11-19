// The item row as SQLite stores it reads into an item, and its two stocking columns into one value. The first row
// below is the `item` row the local database held after an import and an edit (captured, not written by hand); the
// second is the same row as a discontinued item is stored.
import { describe, expect, it } from "@effect/vitest"
import { costDigits } from "@inventory/catalog-contract/Item"
import { ItemRow, storedItem } from "@inventory/catalog-host/ItemRow"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"

const stored = {
  id: "bd396c6e-2445-4c71-a4da-fbf509369ee5",
  sku: "AAT-7076",
  name: "Brass Washer M6",
  description: "Brass washer m6 for general use.",
  category: "components",
  uom: "BX",
  unitCost: "12.5",
  quantityOnHand: 2455,
  reorderPoint: null,
  isActive: 1,
  lotTracked: 0,
  tags: '["rohs"]',
  firstReceivedOn: null,
  discontinuedOn: null,
  dimensions: '{"length":69,"width":27.3,"height":45.4,"unit":"cm"}',
  vendors: "[]",
  createdAt: "2026-11-19T05:06:15.445Z",
  createdBy: "Dana Whitfield",
  revision: 2
}

describe("an item row", () => {
  it.effect("reads into the item it stores, and a discontinued row into a discontinued item", () =>
    Effect.gen(function* () {
      const row = yield* S.decodeUnknownEffect(ItemRow)(stored)
      const item = storedItem(row)
      expect([item.sku, item.name, costDigits(item.unitCost), item.tags, item.stocking, item.revision]).toEqual([
        "AAT-7076",
        "Brass Washer M6",
        "12.5",
        ["rohs"],
        { kind: "active" },
        2
      ])
      expect([item.reorderPoint, item.firstReceivedOn, O.isSome(item.dimensions)]).toEqual([O.none(), O.none(), true])
      expect(DateTime.formatIso(item.createdAt)).toBe("2026-11-19T05:06:15.445Z")
      const gone = yield* S.decodeUnknownEffect(ItemRow)({ ...stored, isActive: 0, discontinuedOn: "2025-02-26" })
      expect(storedItem(gone).stocking).toEqual({ kind: "discontinued", on: "2025-02-26" })
      const paused = yield* S.decodeUnknownEffect(ItemRow)({ ...stored, isActive: 0 })
      expect(storedItem(paused).stocking).toEqual({ kind: "inactive" })
    })
  )
})
