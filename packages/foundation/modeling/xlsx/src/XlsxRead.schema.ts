/**
 * What a read returns: the workbook and what was read past on the way.
 *
 * @packageDocumentation
 */
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { XlsxWarning } from "./XlsxDiagnostic.schema.ts"
import { XlsxWorkbook, type XlsxDroppedKind } from "./XlsxWorkbook.schema.ts"
import { $XlsxId } from "./internal/identity.ts"

export { XlsxContainer } from "./XlsxDiagnostic.schema.ts"

const $I = $XlsxId.create("XlsxRead")

/**
 * A workbook that was read, with the oddities the read went past.
 *
 * @category models
 */
export class XlsxRead extends S.Opaque<XlsxRead, { readonly brand: unique symbol }>()(
  S.Struct({
    workbook: XlsxWorkbook.pipe(S.annotateKey({ description: "The workbook" })),
    warnings: S.Array(XlsxWarning.annotateKey({ description: "One oddity" })).pipe(
      S.annotateKey({ description: "What the read went past, in the order it was found" }),
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    )
  }).pipe($I.annoteSchema("XlsxRead", { description: "A workbook and what was read past" }))
) {
  /** The kinds of part the file held that are not modelled, each once. */
  static readonly droppedKinds = (read: {
    readonly workbook: Pick<XlsxWorkbook, "dropped">
  }): ReadonlyArray<XlsxDroppedKind> => A.dedupe(A.map(read.workbook.dropped, (part) => part.kind))
}
