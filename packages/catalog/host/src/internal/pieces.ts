// How a long list travels to D1: as JSON arrays, each one bound value that a statement reads with json_each. D1 holds
// at most 2 MB in a value and counts it in bytes of UTF-8, of the JSON as it is bound: an "é" is two bytes, a quote in a
// decision (JSON inside JSON) is escaped twice and is four. The one thing not to break: a piece is cut by the bytes it
// really has, measured on the text that is bound, never by the length of what went into it.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as S from "effect/Schema"

/** The most bytes a piece of several values has: half of what D1 takes in one. A value longer on its own goes alone. */
export const pieceBytes = 1_000_000

const encoder = new TextEncoder()

/**
 * How many bytes of UTF-8 a text is, as D1 counts it.
 *
 * @example utf8Bytes("ø 3 mm, 5 €") // 14
 */
export const utf8Bytes = (text: string): number => encoder.encode(text).length

/**
 * A piece of a list as one bound value: a JSON array of one value or more, each encoded by `of`. A statement's request
 * holds the values themselves; encoding the request writes the text json_each reads, so every value in it is one `of`
 * accepts.
 *
 * @example const Request = S.Struct({ items: piece(ItemInsert) }) // binds '[{"sku":"AAT-7076",...}]'
 */
export const piece = <Value, Wire>(of: S.Codec<Value, Wire>) => of.pipe(S.NonEmptyArray, S.fromJsonString)

/** How a list is cut: the codec each value is written by, and the most values a piece holds. */
export interface PieceCut<Value, Wire> {
  readonly of: S.Codec<Value, Wire>
  readonly most: number
}

/** The pieces a list travels in, each one value or more. */
export type Pieces<Value> = ReadonlyArray<A.NonEmptyReadonlyArray<Value>>

// The brackets of an empty piece; each value adds its bytes, and a comma before it when it is not the first.
const emptyWeight = 2

/**
 * Cuts a list into the pieces it travels in, in order: at most `most` values and `pieceBytes` bytes of JSON each (a
 * value longer on its own goes alone), measured on the text each value is encoded as.
 *
 * @example yield* jsonPieces(keys, { of: S.String, most: 5000 }) // [["AAA-0001", "AAA-0002"]]
 * @example yield* pipe(keys, jsonPieces({ of: S.String, most: 5000 }))
 */
export const jsonPieces: {
  <Value, Wire>(
    cut: PieceCut<Value, Wire>
  ): (values: ReadonlyArray<Value>) => Effect.Effect<Pieces<Value>, S.SchemaError>
  <Value, Wire>(values: ReadonlyArray<Value>, cut: PieceCut<Value, Wire>): Effect.Effect<Pieces<Value>, S.SchemaError>
} = dual(
  2,
  <Value, Wire>(
    values: ReadonlyArray<Value>,
    cut: PieceCut<Value, Wire>
  ): Effect.Effect<Pieces<Value>, S.SchemaError> =>
    Effect.map(S.encodeEffect(cut.of.pipe(S.fromJsonString, S.Array))(values), (texts) => {
      // Built in place, value by value: a list of 50,000 is cut in one pass, never copied.
      const pieces: Array<A.NonEmptyArray<Value>> = []
      let current: Array<Value> = []
      let weight = emptyWeight
      A.forEach(A.zip(values, texts), ([value, text]) => {
        const bytes = utf8Bytes(text)
        if (A.isArrayNonEmpty(current) && (current.length >= cut.most || weight + 1 + bytes > pieceBytes)) {
          pieces.push(current)
          current = []
          weight = emptyWeight
        }
        weight += A.isArrayNonEmpty(current) ? 1 + bytes : bytes
        current.push(value)
      })
      if (A.isArrayNonEmpty(current)) pieces.push(current)
      return pieces
    })
)
