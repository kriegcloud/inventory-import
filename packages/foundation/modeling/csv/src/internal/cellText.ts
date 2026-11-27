import * as S from "effect/Schema"
import * as Result from "effect/Result"
import { identity } from "effect/Function"

const cell = S.decodeResult(S.Trim)
/** CsvTrimRule selects this parser transformation; a typed string always decodes successfully. */
export const CsvText = {
  apply: (text: string): string => Result.match(cell(text), { onFailure: () => text, onSuccess: identity })
}
