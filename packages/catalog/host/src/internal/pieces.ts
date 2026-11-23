// How a long list travels to D1: as JSON arrays, each one bound value that a statement reads with json_each. D1 holds
// at most 2 MB in a value and counts it in bytes of UTF-8, of the JSON as it is bound: an "é" is two bytes, a quote in a
// decision (JSON inside JSON) is escaped twice and is four. The one thing not to break: a piece is cut by the bytes it
// really has, measured on the text that is bound, never by the length of what went into it.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
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

/**
 * Cuts a list into the pieces it travels in, in order: at most `most` values and `pieceBytes` bytes of JSON each (a
 * value longer on its own goes alone), measured on the text each value is encoded as.
 *
 * @example yield* jsonPieces({ of: S.String, most: 5000 })(keys) // [["AAA-0001", "AAA-0002"]]
 */
export const jsonPieces = <Value, Wire>(input: {
  readonly of: S.Codec<Value, Wire>
  readonly most: number
}): ((values: ReadonlyArray<Value>) => Effect.Effect<ReadonlyArray<A.NonEmptyReadonlyArray<Value>>, S.SchemaError>) => {
  const encode = S.encodeEffect(input.of.pipe(S.fromJsonString, S.Array))
  return (values) =>
    Effect.map(encode(values), (texts) => {
      const groups: Array<A.NonEmptyArray<Value>> = []
      let current: Array<Value> = []
      // The brackets, then each value with its comma.
      let weight = 2
      A.forEach(A.zip(values, texts), ([value, text]) => {
        const cost = utf8Bytes(text) + 1
        if (A.isArrayNonEmpty(current) && (current.length >= input.most || weight + cost > pieceBytes)) {
          groups.push(current)
          current = []
          weight = 2
        }
        current.push(value)
        weight += cost
      })
      if (A.isArrayNonEmpty(current)) groups.push(current)
      return groups
    })
}
