/**
 * Where things are in CSV text: bounded 0-based positions, a span with its line and character, and how a record
 * ended. Every position counts UTF-16 units of the decoded text; a byte offset is its own schema.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import { lineCharacterAt } from "@beep/utils/Text"
import * as S from "effect/Schema"
import { $CsvId } from "./internal/identity.ts"

const $I = $CsvId.create("CsvPosition")

/**
 * The longest string a JavaScript engine holds (V8: 2^29 - 24 units); it bounds every text position, so generated
 * positions are ones a real text can have.
 *
 * @category constants
 */
export const MAX_TEXT_UNITS = 536_870_888

/**
 * A 0-based position or count in decoded text.
 *
 * **Example** (A valid index)
 *
 * ```ts
 * import { CsvIndex } from "@beep/csv/CsvPosition"
 * import * as S from "effect/Schema"
 *
 * S.is(CsvIndex)(12) // => true
 * ```
 *
 * @category schemas
 */
export const CsvIndex = S.Int.check(S.isBetween({ minimum: 0, maximum: MAX_TEXT_UNITS })).pipe(
  $I.annoteSchema("CsvIndex", {
    description: "A 0-based position or count in decoded text, within the length a JavaScript string can have"
  })
)

/**
 * Runtime type of {@link CsvIndex}.
 *
 * @category models
 */
export type CsvIndex = typeof CsvIndex.Type

/**
 * A 0-based offset into the input bytes, for findings about the encoding.
 *
 * @category schemas
 */
export const CsvByteOffset = S.Int.check(S.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER })).pipe(
  $I.annoteSchema("CsvByteOffset", { description: "A 0-based offset into the input bytes" })
)

/**
 * Runtime type of {@link CsvByteOffset}.
 *
 * @category models
 */
export type CsvByteOffset = typeof CsvByteOffset.Type

/**
 * A stretch of the decoded text: where it starts, how long it is, and the 0-based line and character of its start.
 *
 * **Example** (Locate an offset)
 *
 * ```ts
 * import { CsvTextSpan } from "@beep/csv/CsvPosition"
 *
 * const span = CsvTextSpan.locate("a,b\r\nc", 5, 1)
 * span.line // => 1
 * CsvTextSpan.render(span) // => "2:1"
 * ```
 *
 * @category models
 */
export class CsvTextSpan extends S.Opaque<CsvTextSpan, { readonly brand: unique symbol }>()(
  S.Struct({
    offset: CsvIndex.pipe(S.annotateKey({ description: "First UTF-16 unit of the span" })),
    length: CsvIndex.pipe(S.annotateKey({ description: "UTF-16 units the span covers" })),
    line: CsvIndex.pipe(S.annotateKey({ description: "0-based physical line of the first unit" })),
    character: CsvIndex.pipe(S.annotateKey({ description: "0-based unit of the first unit within its line" }))
  }).pipe($I.annoteSchema("CsvTextSpan", { description: "Where something is in the decoded text" }))
) {
  /** The span at `offset`, its line and character counted from `text` (`\n`, `\r` and `\r\n` each break a line). */
  static readonly locate = (text: string, offset: number, length: number): CsvTextSpan => {
    const at = lineCharacterAt(text, offset)
    return CsvTextSpan.make({ offset, length, line: at.line, character: at.character })
  }

  /** The 1-based "line:column" a person counts in an editor. */
  static readonly render = (span: Pick<CsvTextSpan, "line" | "character">): string =>
    `${span.line + 1}:${span.character + 1}`
}

/**
 * How a record ended in the source: a line feed, a carriage return and line feed, a lone carriage return, or the end
 * of the input with no line break after it.
 *
 * @category schemas
 */
export const CsvRecordEnd = LiteralKit(["LF", "CRLF", "CR", "EndOfInput"]).pipe(
  $I.annoteSchema("CsvRecordEnd", { description: "How a record ended in the source" })
)

/**
 * Runtime type of {@link CsvRecordEnd}.
 *
 * @category models
 */
export type CsvRecordEnd = typeof CsvRecordEnd.Type

/**
 * The characters each record end stands for.
 *
 * @category utilities
 */
export const recordEndText = CsvRecordEnd.match({
  LF: () => "\n",
  CRLF: () => "\r\n",
  CR: () => "\r",
  EndOfInput: () => ""
})
