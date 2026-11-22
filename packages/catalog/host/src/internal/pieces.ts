// How a long list travels to D1: as JSON arrays, each one bound value that a statement reads with json_each. D1 holds
// at most 2 MB in a value and counts it in bytes of UTF-8, of the JSON as it is bound: an "é" is two bytes, a quote in a
// decision (JSON inside JSON) is escaped twice and is four. The one thing not to break: a piece is cut by the bytes it
// really has, measured on the text that is bound, never by the length of what went into it.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as Str from "effect/String"

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
 * Cuts JSON values into JSON arrays of at most `most` values and `pieceBytes` bytes each, in order.
 *
 * @example pieced({ values: ['"a"', '"b"', '"c"'], most: 2 }) // ['["a","b"]', '["c"]']
 */
export const pieced = (input: {
  readonly values: ReadonlyArray<string>
  readonly most: number
}): ReadonlyArray<string> => {
  const groups: Array<Array<string>> = []
  let current: Array<string> = []
  // The brackets, then each value with its comma.
  let weight = 2
  for (const value of input.values) {
    const cost = utf8Bytes(value) + 1
    if (current.length > 0 && (current.length >= input.most || weight + cost > pieceBytes)) {
      groups.push(current)
      current = []
      weight = 2
    }
    current.push(value)
    weight += cost
  }
  if (current.length > 0) groups.push(current)
  return A.map(groups, (group) => `[${A.join(group, ",")}]`)
}

/**
 * The pieces a list of values travels in, each value encoded by its schema (`of`), at most `most` to a piece: ready to
 * be bound as they are.
 *
 * @example yield* jsonPieces({ of: S.String, most: 5000 })(keys) // ['["AAA-0001","AAA-0002"]']
 */
export const jsonPieces = <Value, Wire>(input: {
  readonly of: S.Codec<Value, Wire>
  readonly most: number
}): ((values: ReadonlyArray<Value>) => Effect.Effect<ReadonlyArray<string>, S.SchemaError>) => {
  const encode = S.encodeEffect(input.of.pipe(S.fromJsonString, S.Array))
  return (values) => Effect.map(encode(values), (texts) => pieced({ values: texts, most: input.most }))
}

/** A piece as it is bound: a JSON array, already encoded. */
export const JsonPiece = S.String.check(S.makeFilter((piece: string) => Str.startsWith("[")(piece))).annotate({
  identifier: "JsonPiece",
  description: "A JSON array of values, as one bound value a statement reads with json_each"
})
