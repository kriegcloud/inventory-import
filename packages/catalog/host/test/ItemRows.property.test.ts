// The items a confirm writes travel to D1 as JSON a statement reads with json_each, and the unique index on
// (organizationId, skuKey) is what makes a second load of the same file add nothing. So every item written carries the
// key its SKU is compared by, and every piece bound is a JSON array of exactly the items it was cut from.
import { describe, expect, it } from "@effect/vitest"
import { skuKey } from "@inventory/catalog-contract/Item"
import { ItemInsert, ItemsPiece } from "@inventory/catalog-host/ImportRows"
import { jsonPieces, pieceBytes, utf8Bytes } from "@inventory/catalog-host/Pieces"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as S from "effect/Schema"

const runs = { arbitrary: { runs: 200 } }

// An item drawn on its wire side and decoded through `ItemInsert`: the contract's `UnitCost` draws any decimal on its
// decoded side and discards nearly all of them, so `ItemInsert`'s own decoded side cannot be drawn directly.
const anItem = Arbitrary.filterMap(ItemInsert.pipe(S.toEncoded, Arbitrary.schema), S.decodeResult(ItemInsert))

/** The bound text as json_each reads it: the rows of a JSON array, or none when it is not one. */
const rowsOf = S.decodeOption(S.fromJsonString(S.Array(S.Record(S.String, S.Unknown))))

/** A stored row's key is its SKU's key, and its quantity a count: what the item table relies on. */
const writable = (row: Readonly<Record<string, unknown>>): boolean =>
  P.isString(row["sku"]) &&
  row["skuKey"] === skuKey({ sku: row["sku"] }) &&
  P.isNumber(row["quantityOnHand"]) &&
  Number.isInteger(row["quantityOnHand"]) &&
  row["quantityOnHand"] >= 0

describe("the items a confirm writes", () => {
  it.effect.prop(
    "an item is written with the key of its own SKU",
    [anItem],
    ([item]) =>
      Effect.gen(function* () {
        const row = yield* S.encodeEffect(ItemInsert)(item)
        expect(row.skuKey).toBe(skuKey({ sku: row.sku }))
      }),
    runs
  )

  it.effect.prop(
    "a piece bound to the insert is a JSON array whose every row the item table can hold",
    [Arbitrary.array(anItem, { minLength: 1 })],
    ([items]) =>
      Effect.gen(function* () {
        if (!A.isReadonlyArrayNonEmpty(items)) return
        const text = yield* S.encodeEffect(ItemsPiece)(items)
        const rows = rowsOf(text)
        expect(O.isSome(rows)).toBe(true)
        if (O.isSome(rows)) {
          expect(rows.value.length).toBeGreaterThan(0)
          expect(A.every(rows.value, writable)).toBe(true)
        }
      }),
    runs
  )

  it.effect.prop(
    "a list is cut into pieces that hold every item once, in order, none over its size",
    [Arbitrary.array(anItem)],
    ([items]) =>
      Effect.gen(function* () {
        const most = 3
        const pieces = yield* jsonPieces({ of: ItemInsert, most })(items)
        expect(A.flatten(pieces)).toEqual(items)
        const encodePiece = S.encodeEffect(ItemsPiece)
        const texts = yield* Effect.forEach(pieces, (group) => encodePiece(group), { concurrency: 1 })
        A.forEach(A.zip(pieces, texts), ([group, text]) => {
          expect(group.length).toBeLessThanOrEqual(most)
          if (group.length > 1) expect(utf8Bytes(text)).toBeLessThanOrEqual(pieceBytes)
        })
      }),
    runs
  )
})
