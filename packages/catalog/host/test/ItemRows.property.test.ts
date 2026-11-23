// The items a confirm writes travel to D1 as JSON a statement reads with json_each, and the unique index on
// (organizationId, skuKey) is what makes a second load of the same file add nothing. So every item written carries the
// key its SKU is compared by, every piece bound is a JSON array of exactly the items it was cut from, and a list is cut
// by the bytes its JSON really has, never past what D1 takes in one value.
import { describe, expect, it } from "@effect/vitest"
import { skuKey } from "@inventory/catalog-contract/Item"
import { ItemInsert, ItemsPiece } from "@inventory/catalog-host/ImportRows"
import { jsonPieces, pieceBytes } from "@inventory/catalog-host/Pieces"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"

const runs = { arbitrary: { runs: 200 } }

const anItem = Arbitrary.schema(ItemInsert)

/** A row as the item table holds one: a SKU, the key it is compared by, and a count on hand. */
const TableRow = S.Struct({
  sku: S.String,
  skuKey: S.String,
  quantityOnHand: S.Int.check(S.isGreaterThanOrEqualTo(0))
})

/** The bound text as json_each reads it: the rows of a JSON array, or none when it is not one the table can hold. */
const rowsOf = S.decodeOption(S.fromJsonString(S.NonEmptyArray(TableRow)))

/**
 * Text long enough to reach a piece's limit, written as one character repeated: its bytes as JSON are known from the
 * character alone, with no encoder. A quote is escaped (two bytes), "é" is two bytes of UTF-8 and "€" three.
 */
const LongText = S.Struct({
  size: S.Union([
    S.Int.check(S.isBetween({ minimum: 1, maximum: 1000 })),
    S.Int.check(S.isBetween({ minimum: 333_320, maximum: 333_350 })),
    S.Int.check(S.isBetween({ minimum: 499_990, maximum: 500_010 })),
    S.Int.check(S.isBetween({ minimum: 999_990, maximum: 1_000_010 }))
  ]),
  char: S.Literals(["a", "é", '"', "€"])
})
type LongText = typeof LongText.Type

const bytesPerChar: Readonly<Record<LongText["char"], number>> = { a: 1, é: 2, '"': 2, "€": 3 }

/**
 * A piece drawn to land on the edge: one to three values of up to 100,000 characters, then a last value of "a"s sized
 * so the piece of them all has exactly `offset` bytes more than a piece may hold.
 */
const AtTheEdge = S.Struct({
  before: S.NonEmptyArray(
    S.Struct({
      size: S.Int.check(S.isBetween({ minimum: 1, maximum: 100_000 })),
      char: LongText.fields.char
    })
  ).check(S.isMaxLength(3)),
  offset: S.Int.check(S.isBetween({ minimum: -2, maximum: 2 }))
})

/** The bytes of a value's JSON: its characters, and the two quotes around it. */
const jsonBytes = (long: LongText): number => 2 + long.size * bytesPerChar[long.char]

/** The bytes of a piece's JSON: its brackets, its values, and a comma between each two. */
const pieceSize = (values: ReadonlyArray<LongText>): number =>
  2 + A.reduce(values, 0, (sum, long) => sum + jsonBytes(long)) + Math.max(0, values.length - 1)

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
    "a piece bound to the insert is a JSON array of rows the item table can hold, each keyed by its own SKU",
    [Arbitrary.array(anItem, { minLength: 1 })],
    ([items]) =>
      Effect.gen(function* () {
        if (!A.isReadonlyArrayNonEmpty(items)) return
        const text = yield* S.encodeEffect(ItemsPiece)(items)
        const rows = rowsOf(text)
        expect(O.map(rows, A.length)).toEqual(O.some(items.length))
        if (O.isSome(rows)) {
          A.forEach(rows.value, (row) => expect(row.skuKey).toBe(skuKey({ sku: row.sku })))
        }
      }),
    runs
  )

  it.effect.prop(
    "a list is cut into pieces that hold every item once, in order, none over its count",
    [Arbitrary.array(anItem), Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 1, maximum: 4 })))],
    ([items, most]) =>
      Effect.gen(function* () {
        const pieces = yield* jsonPieces(items, { of: ItemInsert, most })
        expect(A.flatten(pieces)).toEqual(items)
        A.forEach(pieces, (group) => expect(group.length).toBeLessThanOrEqual(most))
      }),
    runs
  )

  it.effect.prop(
    "long values are cut by their bytes: a piece of several stays within the limit, one too long goes alone, and no " +
      "piece is cut while the next value still fits",
    [
      Arbitrary.array(Arbitrary.schema(LongText), { minLength: 1, maxLength: 6 }),
      Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 1, maximum: 6 })))
    ],
    ([longs, most]) =>
      Effect.gen(function* () {
        const texts = A.map(longs, (long) => Str.repeat(long.size)(long.char))
        const pieces = yield* pipe(texts, jsonPieces({ of: S.String, most }))
        expect(A.flatten(pieces)).toEqual(texts)
        // The pieces as the values drawn, in order, so each is measured from the drawing alone.
        const drawn = A.reduce(pieces, { at: 0, groups: A.empty<ReadonlyArray<LongText>>() }, (cut, group) => ({
          at: cut.at + group.length,
          groups: A.append(cut.groups, A.take(A.drop(longs, cut.at), group.length))
        })).groups
        A.forEach(drawn, (group, index) => {
          if (group.length > 1) expect(pieceSize(group)).toBeLessThanOrEqual(pieceBytes)
          const next = O.flatMap(A.get(drawn, index + 1), A.head)
          if (O.isSome(next)) {
            const fits = group.length < most && pieceSize(A.append(group, next.value)) <= pieceBytes
            expect(fits).toBe(false)
          }
        })
      }),
    { arbitrary: { runs: 40 } }
  )

  it.effect.prop(
    "a piece holds the next value exactly when its JSON with that value has no more bytes than a piece may",
    [Arbitrary.schema(AtTheEdge)],
    ([edge]) =>
      Effect.gen(function* () {
        // Brackets, the values before, a comma and the last value's quotes: the rest of the limit is its "a"s.
        const last: LongText = { size: pieceBytes + edge.offset - pieceSize(edge.before) - 3, char: "a" }
        const longs = A.append(edge.before, last)
        const texts = A.map(longs, (long) => Str.repeat(long.size)(long.char))
        expect(pieceSize(longs)).toBe(pieceBytes + edge.offset)
        const pieces = yield* jsonPieces(texts, { of: S.String, most: 10 })
        const before = A.map(edge.before, (long) => Str.repeat(long.size)(long.char))
        expect(pieces).toEqual(edge.offset <= 0 ? [texts] : [before, [Str.repeat(last.size)("a")]])
      }),
    { arbitrary: { runs: 100 } }
  )
})
