import * as S from "effect/Schema"
import * as SchemaGetter from "effect/SchemaGetter"
import * as Result from "effect/Result"
import { identity } from "effect/Function"
import { $ReviewId } from "./identity.ts"
const $I = $ReviewId.create("internal/ReviewText")

const Comparison = S.Trim.pipe($I.annoteSchema("Comparison", { description: "A spelling without surrounding spaces" }))
const Word = S.String.pipe(
  S.decodeTo(S.String, { decode: SchemaGetter.toLowerCase(), encode: SchemaGetter.passthrough() }),
  $I.annoteSchema("Word", { description: "Lowercase presentation words" })
)
const Capital = S.String.pipe(
  S.decodeTo(S.String, { decode: SchemaGetter.toUpperCase(), encode: SchemaGetter.passthrough() }),
  $I.annoteSchema("Capital", { description: "Uppercase comparison words" })
)
const Facet = S.Trim.pipe(
  S.decodeTo(Word),
  $I.annoteSchema("Facet", { description: "A trimmed case-insensitive facet key" })
)
const comparison = S.decodeResult(Comparison)
const word = S.decodeResult(Word)
const capital = S.decodeResult(Capital)
const facet = S.decodeResult(Facet)

/** These schemas transform every typed string; the failure case retains its input without inventing text. */
export const ReviewText = {
  comparison: (value: string): string =>
    Result.match(comparison(value), { onFailure: () => value, onSuccess: identity }),
  word: (value: string): string => Result.match(word(value), { onFailure: () => value, onSuccess: identity }),
  capital: (value: string): string => Result.match(capital(value), { onFailure: () => value, onSuccess: identity }),
  facet: (value: string): string => Result.match(facet(value), { onFailure: () => value, onSuccess: identity })
}
