/**
 * The one error a D1 statement fails with: its request could not be encoded, the SQL failed, or its rows did not
 * decode.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as S from "effect/Schema"
import { $D1Id } from "./internal/identity.ts"

const $I = $D1Id.create("D1Error")

/**
 * Where a statement failed: encoding its request, running its SQL, or decoding the rows it answered.
 *
 * @category schemas
 */
export const D1Stage = LiteralKit(["encode", "execute", "decode"]).pipe(
  $I.annoteSchema("D1Stage", { description: "Encoding a request, running SQL, or decoding its rows" })
)

/**
 * The decoded value of `D1Stage`.
 *
 * @category models
 */
export type D1Stage = typeof D1Stage.Type

/**
 * One statement could not be encoded, run or decoded. `statement` is its position in its batch (0 for a statement
 * run alone); `cause` keeps the `SqlError` or `SchemaError` underneath for the log. A service maps it to its own error
 * or dies; it never reaches a person as itself.
 *
 * @category errors
 */
export class D1Error extends S.TaggedError<D1Error, { readonly brand: unique symbol }>($I`D1Error`)(
  "D1Error",
  {
    stage: D1Stage.pipe(S.annotateKey({ description: "Encoding a request, running SQL, or decoding its rows" })),
    statement: S.Int.check(S.isBetween({ minimum: 0, maximum: 9999 })).pipe(
      S.annotateKey({ description: "The statement's position in its batch; 0 for a statement run alone" })
    ),
    cause: S.Defect().pipe(S.annotateKey({ description: "The SqlError or SchemaError underneath" }))
  },
  $I.annoteError<D1Error>("D1Error", { description: "One D1 statement could not be encoded, run or decoded" })
) {
  /** A short sentence for the log: the stage and the statement's position. */
  override get message(): string {
    return `D1 statement ${this.statement} ${D1Stage.match(this.stage, {
      encode: () => "could not be encoded from its request",
      execute: () => "failed in SQL",
      decode: () => "answered rows its result Schema refuses"
    })}`
  }
}
